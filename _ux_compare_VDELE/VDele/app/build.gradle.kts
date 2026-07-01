plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ═══ Auto-build web assets ═══════════════════════════════════════════
// This runs automatically before Android build — no command line needed.
// Just click "Build" in Android Studio.
val buildWebAssets by tasks.registering(Exec::class) {
    val webDir = rootProject.file("escrow_proj")
    val assetsDir = file("src/main/assets/www")
    val patchesDir = rootProject.file("web_patches")

    workingDir = webDir
    inputs.dir(webDir.resolve("src"))
    inputs.file(webDir.resolve("package.json"))
    inputs.dir(patchesDir)
    outputs.dir(assetsDir)

    // Detect OS for shell
    val isWin = System.getProperty("os.name").lowercase().contains("win")

    doFirst {
        // Apply Android patches (HashRouter + relative base)
        patchesDir.resolve("routes.android.tsx").copyTo(
            webDir.resolve("src/app/routes.tsx"), overwrite = true
        )
        patchesDir.resolve("vite.config.android.ts").copyTo(
            webDir.resolve("vite.config.ts"), overwrite = true
        )
    }

    if (isWin) {
        commandLine("cmd", "/c", "pnpm install && pnpm build || npm install && npm run build")
    } else {
        commandLine("bash", "-c", "pnpm install && pnpm build || npm install && npm run build")
    }

    doLast {
        // Copy dist → assets/www
        assetsDir.deleteRecursively()
        webDir.resolve("dist").copyRecursively(assetsDir, overwrite = true)
        println("✓ Web assets built → app/src/main/assets/www/")
    }
}

tasks.named("preBuild") {
    val marker = file("src/main/assets/www/assets")
    // Only auto-build if real Vite output doesn't exist (assets/ dir with JS bundles)
    if (!marker.exists()) {
        dependsOn(buildWebAssets)
    }
}
// ═════════════════════════════════════════════════════════════════════

android {
    namespace = "com.vdele.app"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "2.0.0"
    }

    flavorDimensions += "role"

    productFlavors {
        create("customer") {
            dimension = "role"
            applicationId = "com.vdele.customer"
            versionNameSuffix = "-customer"
            manifestPlaceholders["appLabel"] = "В Деле"
            buildConfigField("String", "ENTRY_PATH", "\"customer\"")
            buildConfigField("String", "SPLASH_TITLE", "\"В Деле\"")
            buildConfigField("String", "SPLASH_SUB", "\"Надёжные специалисты для ремонта\"")
        }
        create("specialist") {
            dimension = "role"
            applicationId = "com.vdele.specialist"
            versionNameSuffix = "-specialist"
            manifestPlaceholders["appLabel"] = "В Деле Мастер"
            buildConfigField("String", "ENTRY_PATH", "\"specialist\"")
            buildConfigField("String", "SPLASH_TITLE", "\"В Деле Мастер\"")
            buildConfigField("String", "SPLASH_SUB", "\"Заказы и управление работами\"")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { viewBinding = true; buildConfig = true }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
}
