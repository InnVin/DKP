import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Search, ArrowLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "../store/AppStore";

export default function CustomerSearch() {
  const navigate = useNavigate();
  const { services, categories } = useAppStore();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return services.filter(
      (s) => s.published && (s.name.toLowerCase().includes(qq) || s.description.toLowerCase().includes(qq))
    );
  }, [services, q]);

  const popularCategories = categories.slice(0, 6);

  return (
    <div className="h-screen flex flex-col bg-[#F2F2F7]">
      {/* Search header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl active:bg-gray-100" style={{ minWidth: 44, minHeight: 44 }}>
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск услуг..."
            autoFocus
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6]/30"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!q && (
          <div>
            <div className="text-sm font-semibold text-gray-500 mb-3">Популярные категории</div>
            <div className="grid grid-cols-2 gap-2">
              {popularCategories.map((cat) => (
                <button
                  key={cat.id}
                  className="bg-white rounded-2xl p-3 text-left border border-gray-100 active:border-[#14B8A6]/50 transition-all flex items-center gap-3"
                  onClick={() => navigate(`/customer/category/${cat.id}`)}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {q && results.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-sm">Ничего не найдено</div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((s) => (
              <button
                key={s.id}
                className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 active:border-[#14B8A6]/50 transition-all"
                onClick={() => navigate(`/customer/service/${s.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{s.description}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="text-sm font-bold text-[#14B8A6]">{s.basePrice.toLocaleString('ru-RU')} ₽</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
