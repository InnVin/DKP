import React, { useMemo, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card } from '../components/vdele/Card';
import { Button } from '../components/vdele/Button';
import { Input } from '../components/vdele/Input';
import { useAppStore } from '../store/AppStore';
import type { Service, ServiceCategory, ServiceParameter } from '../types';
import { Plus, Search, CheckCircle2, XCircle, Trash2, Tag, Settings2 } from 'lucide-react';

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

const feePresets = [
  { label: '8%', value: 0.08 },
  { label: '10%', value: 0.1 },
  { label: '12%', value: 0.12 },
];

export default function AdminCatalog() {
  const { categories, services, actions } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState<Pick<ServiceCategory, 'name' | 'icon' | 'id'>>({ id: '', name: '', icon: '🧰' });

  const selected = services.find((s) => s.id === selectedServiceId) ?? null;
  const [draft, setDraft] = useState<Service | null>(selected);

  // keep draft in sync when selecting another service
  React.useEffect(() => {
    setDraft(selected);
  }, [selectedServiceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services
      .filter((s) => (q ? `${s.name} ${s.description}`.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }, [services, query]);

  const publishedCount = services.filter((s) => s.published).length;

  const upsertDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) return;
    actions.upsertService(draft);
  };

  const createService = () => {
    const id = uid('svc');
    const cat = categories[0]?.id ?? 'plumbing';
    const now = new Date().toISOString();
    const s: Service = {
      id,
      categoryId: cat,
      name: 'Новая услуга',
      description: 'Короткое описание (что входит, условия, ограничения)',
      basePrice: 2000,
      feePercent: 0.08,
      policy: { cancelWindowMinutes: 30, disputeWindowHours: 24, autoReleaseHours: 24, disputeSlaHours: 48 },
      parameters: [],
      published: false,
      version: 1,
      updatedAt: now,
    };
    actions.upsertService(s);
    setSelectedServiceId(id);
  };

  const createCategory = () => {
    const id = newCategory.id.trim() || toSlug(newCategory.name) || uid('cat');
    if (!newCategory.name.trim()) return;
    actions.upsertCategory({ id, name: newCategory.name.trim(), icon: newCategory.icon || '🧰' });
    setNewCategory({ id: '', name: '', icon: '🧰' });
    setShowNewCategory(false);
  };

  const addParam = () => {
    if (!draft) return;
    const p: ServiceParameter = {
      id: uid('p'),
      name: 'Параметр',
      type: 'select',
      required: true,
      options: [
        { label: 'Вариант 1', value: 'v1', priceModifier: 0 },
        { label: 'Вариант 2', value: 'v2', priceModifier: 500 },
      ],
    };
    setDraft({ ...draft, parameters: [...draft.parameters, p] });
  };

  const removeParam = (paramId: string) => {
    if (!draft) return;
    setDraft({ ...draft, parameters: draft.parameters.filter((p) => p.id !== paramId) });
  };

  const updateParam = (paramId: string, patch: Partial<ServiceParameter>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      parameters: draft.parameters.map((p) => (p.id === paramId ? { ...p, ...patch } : p)),
    });
  };

  const addOption = (paramId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      parameters: draft.parameters.map((p) => {
        if (p.id !== paramId) return p;
        const next = {
          label: `Опция ${((p.options?.length ?? 0) + 1).toString()}`,
          value: uid('opt'),
          priceModifier: 0,
        };
        return { ...p, options: [...(p.options ?? []), next] };
      }),
    });
  };

  const removeOption = (paramId: string, value: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      parameters: draft.parameters.map((p) => {
        if (p.id !== paramId) return p;
        return { ...p, options: (p.options ?? []).filter((o) => o.value !== value) };
      }),
    });
  };

  const updateOption = (paramId: string, value: string, patch: Partial<{ label: string; priceModifier: number }>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      parameters: draft.parameters.map((p) => {
        if (p.id !== paramId) return p;
        return {
          ...p,
          options: (p.options ?? []).map((o) => (o.value === value ? { ...o, ...patch } : o)),
        };
      }),
    });
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Каталог услуг</h1>
            <p className="text-gray-600 mt-1">Конструктор услуг: параметры → расчёт → политики escrow</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Опубликовано: <span className="font-semibold text-gray-900">{publishedCount}</span></div>
            <Button variant="primary" onClick={createService} className="px-4">
              <Plus className="w-4 h-4" />
              <span className="ml-2">Новая услуга</span>
            </Button>
          </div>
        </div>

        {/* Categories */}
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#0F766E]" />
              <div className="font-semibold text-gray-900">Категории</div>
            </div>
            <button className="text-sm text-[#14B8A6] font-medium hover:underline" onClick={() => setShowNewCategory((v) => !v)}>
              {showNewCategory ? 'Скрыть' : 'Добавить'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <div key={c.id} className="px-3 py-2 rounded-[14px] bg-gray-50 border border-gray-100 flex items-center gap-2">
                <span>{c.icon}</span>
                <span className="text-sm font-medium text-gray-900">{c.name}</span>
                <button
                  className="ml-1 text-gray-400 hover:text-gray-700"
                  title="Удалить категорию (и её услуги)"
                  onClick={() => actions.deleteCategory(c.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {showNewCategory && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Emoji" value={newCategory.icon} onChange={(e) => setNewCategory((s) => ({ ...s, icon: e.target.value }))} />
              <Input placeholder="Название категории" value={newCategory.name} onChange={(e) => setNewCategory((s) => ({ ...s, name: e.target.value }))} />
              <div className="flex gap-2">
                <Input placeholder="ID (опционально)" value={newCategory.id} onChange={(e) => setNewCategory((s) => ({ ...s, id: e.target.value }))} />
                <Button variant="secondary" onClick={createCategory}>Создать</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Main */}
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          {/* List */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по услугам"
                className="w-full bg-transparent outline-none text-sm"
              />
            </div>

            <div className="space-y-2">
              {filtered.map((s) => {
                const active = s.id === selectedServiceId;
                const cat = categories.find((c) => c.id === s.categoryId);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServiceId(s.id)}
                    className={
                      'w-full text-left p-4 rounded-[18px] border transition ' +
                      (active ? 'border-[#14B8A6] bg-[#14B8A6]/5' : 'border-gray-100 hover:border-gray-200 bg-white')
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{s.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{cat ? `${cat.icon} ${cat.name}` : s.categoryId} • v{s.version}</div>
                      </div>
                      <div className={
                        'text-xs font-semibold px-2 py-1 rounded-full ' +
                        (s.published ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-gray-100 text-gray-600')
                      }>
                        {s.published ? 'PUBLISHED' : 'DRAFT'}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm text-gray-600">от {s.basePrice.toLocaleString('ru-RU')} ₽</div>
                      <div className="text-xs text-gray-500">fee {(s.feePercent * 100).toFixed(0)}%</div>
                    </div>
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-6 text-center text-gray-600">Ничего не найдено</div>
              )}
            </div>
          </Card>

          {/* Editor */}
          <Card className="p-6">
            {!draft ? (
              <div className="text-gray-600">Выберите услугу слева</div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-xs text-gray-500">Service ID: {draft.id}</div>
                    <div className="text-2xl font-bold text-gray-900">Редактор услуги</div>
                    <div className="text-gray-600 mt-1">Параметры влияют на расчёт цены и escrow-политику заказа.</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {draft.published ? (
                      <Button variant="secondary" onClick={() => actions.archiveService(draft.id)}>
                        <XCircle className="w-4 h-4" />
                        <span className="ml-2">Снять с публикации</span>
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={() => actions.publishService(draft.id)}>
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="ml-2">Опубликовать</span>
                      </Button>
                    )}
                    <Button variant="secondary" onClick={upsertDraft}>Сохранить</Button>
                  </div>
                </div>

                {/* Basics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Название</div>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Категория</div>
                    <select
                      className="h-12 w-full rounded-[16px] border border-gray-100 bg-white px-4"
                      value={draft.categoryId}
                      onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-sm font-medium text-gray-700 mb-2">Описание</div>
                    <textarea
                      className="w-full min-h-[88px] rounded-[16px] border border-gray-100 bg-white px-4 py-3"
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Базовая цена (₽)</div>
                    <Input
                      type="number"
                      value={draft.basePrice}
                      onChange={(e) => setDraft({ ...draft, basePrice: Number(e.target.value || 0) })}
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Комиссия платформы</div>
                    <div className="flex gap-2">
                      <select
                        className="h-12 rounded-[16px] border border-gray-100 bg-white px-4"
                        value={draft.feePercent}
                        onChange={(e) => setDraft({ ...draft, feePercent: Number(e.target.value) })}
                      >
                        {feePresets.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        value={Math.round(draft.feePercent * 100)}
                        onChange={(e) => setDraft({ ...draft, feePercent: Math.max(0, Number(e.target.value || 0) / 100) })}
                      />
                      <div className="text-sm text-gray-500 flex items-center">%</div>
                    </div>
                  </div>
                </div>

                {/* Policy */}
                <Card className="p-5 bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 className="w-5 h-5 text-gray-700" />
                    <div className="font-semibold text-gray-900">Escrow / Dispute политика</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Cancel window (мин)</div>
                      <Input
                        type="number"
                        value={draft.policy.cancelWindowMinutes}
                        onChange={(e) => setDraft({ ...draft, policy: { ...draft.policy, cancelWindowMinutes: Number(e.target.value || 0) } })}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Dispute window (ч)</div>
                      <Input
                        type="number"
                        value={draft.policy.disputeWindowHours}
                        onChange={(e) => setDraft({ ...draft, policy: { ...draft.policy, disputeWindowHours: Number(e.target.value || 0) } })}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Auto-release (ч)</div>
                      <Input
                        type="number"
                        value={draft.policy.autoReleaseHours}
                        onChange={(e) => setDraft({ ...draft, policy: { ...draft.policy, autoReleaseHours: Number(e.target.value || 0) } })}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">SLA dispute (ч)</div>
                      <Input
                        type="number"
                        value={draft.policy.disputeSlaHours}
                        onChange={(e) => setDraft({ ...draft, policy: { ...draft.policy, disputeSlaHours: Number(e.target.value || 0) } })}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mt-3">
                    Эти параметры попадут в <span className="font-semibold">Order.policy</span> при создании заказа и будут управлять: отменой, авто-выплатой и окнами спора.
                  </div>
                </Card>

                {/* Parameters */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">Параметры (конструктор)</div>
                      <div className="text-sm text-gray-600">Параметры влияют на итоговую цену через priceModifier.</div>
                    </div>
                    <Button variant="secondary" onClick={addParam}>
                      <Plus className="w-4 h-4" />
                      <span className="ml-2">Добавить параметр</span>
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {draft.parameters.map((p) => (
                      <Card key={p.id} className="p-4 border border-gray-100">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Название</div>
                              <Input value={p.name} onChange={(e) => updateParam(p.id, { name: e.target.value })} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Тип</div>
                              <select
                                className="h-12 w-full rounded-[16px] border border-gray-100 bg-white px-4"
                                value={p.type}
                                onChange={(e) => updateParam(p.id, { type: e.target.value as any })}
                              >
                                <option value="select">select</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                              </select>
                            </div>
                            <div className="flex items-end gap-2">
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={p.required}
                                  onChange={(e) => updateParam(p.id, { required: e.target.checked })}
                                />
                                Обязательный
                              </label>
                            </div>
                          </div>

                          <button className="text-gray-400 hover:text-gray-700" onClick={() => removeParam(p.id)} title="Удалить параметр">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        {p.type === 'select' && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium text-gray-900">Опции</div>
                              <button className="text-sm text-[#14B8A6] font-medium hover:underline" onClick={() => addOption(p.id)}>
                                Добавить опцию
                              </button>
                            </div>

                            <div className="space-y-2">
                              {(p.options ?? []).map((o) => (
                                <div key={o.value} className="grid grid-cols-1 md:grid-cols-[1fr_180px_40px] gap-2 items-center">
                                  <Input value={o.label} onChange={(e) => updateOption(p.id, o.value, { label: e.target.value })} />
                                  <Input
                                    type="number"
                                    value={o.priceModifier}
                                    onChange={(e) => updateOption(p.id, o.value, { priceModifier: Number(e.target.value || 0) })}
                                  />
                                  <button className="text-gray-400 hover:text-gray-700" onClick={() => removeOption(p.id, o.value)} title="Удалить">
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              ))}

                              {(p.options ?? []).length === 0 && (
                                <div className="text-sm text-gray-600">Нет опций. Добавь хотя бы одну.</div>
                              )}
                            </div>
                          </div>
                        )}

                        {p.type !== 'select' && (
                          <div className="mt-3 text-sm text-gray-600">
                            Для типов <span className="font-semibold">{p.type}</span> priceModifier не применяется (упрощение демо).
                          </div>
                        )}
                      </Card>
                    ))}

                    {draft.parameters.length === 0 && (
                      <Card className="p-6 text-center text-gray-600">
                        У услуги нет параметров. Добавь параметры, чтобы цена стала гибкой.
                      </Card>
                    )}
                  </div>
                </div>

                {/* Preview */}
                <Card className="p-5 bg-gradient-to-br from-[#0B1220] to-[#111827] text-white border border-white/10">
                  <div className="text-white/70 text-sm">Превью (как увидит заказчик)</div>
                  <div className="text-xl font-semibold mt-1">{draft.name}</div>
                  <div className="text-white/70 text-sm mt-2">{draft.description}</div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-[18px] bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs">База</div>
                      <div className="font-semibold">{draft.basePrice.toLocaleString('ru-RU')} ₽</div>
                    </div>
                    <div className="p-3 rounded-[18px] bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs">Комиссия</div>
                      <div className="font-semibold">{Math.round(draft.feePercent * 100)}%</div>
                    </div>
                    <div className="p-3 rounded-[18px] bg-white/5 border border-white/10">
                      <div className="text-white/60 text-xs">Автовыплата</div>
                      <div className="font-semibold">{draft.policy.autoReleaseHours} ч</div>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-white/70">
                    В реальном продукте сюда добавится: проверка обязательных параметров, динамические прайс-правила, минимальная стоимость, доплаты за срочность и т.п.
                  </div>
                </Card>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
