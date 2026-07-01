package com.vdele.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashOverlay: FrameLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var errorView: FrameLayout
    private var isAppLoaded = false

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        splash.setKeepOnScreenCondition { !isAppLoaded }
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView       = findViewById(R.id.webview)
        splashOverlay = findViewById(R.id.splash_overlay)
        progressBar   = findViewById(R.id.progress_bar)
        swipeRefresh  = findViewById(R.id.swipe_refresh)
        errorView     = findViewById(R.id.error_view)

        findViewById<TextView>(R.id.splash_title).text    = BuildConfig.SPLASH_TITLE
        findViewById<TextView>(R.id.splash_subtitle).text = BuildConfig.SPLASH_SUB

        setupWebView()
        setupSwipeRefresh()
        setupBackNavigation()
        loadApp()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        // Security: disable WebView debugging in release (DeepSeek audit P0)
        android.webkit.WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled   = true
            allowFileAccess   = true
            allowContentAccess = true
            // File access: enabled for local assets loading
            // In production with remote backend, these should be FALSE
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = true  // TODO: set to false when serving from backend URL
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = true  // TODO: set to false when serving from backend URL
            mixedContentMode  = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode         = WebSettings.LOAD_DEFAULT
            useWideViewPort   = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls  = false
            displayZoomControls  = false
            textZoom = 100
            mediaPlaybackRequiresUserGesture = false
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (!isAppLoaded) {
                    isAppLoaded = true
                    // Navigate WebView to the correct flavor route via hash
                    val path = BuildConfig.ENTRY_PATH
                    view?.evaluateJavascript(
                        "if(!location.hash || location.hash==='#/' || location.hash==='#') location.hash='#/$path';",
                        null
                    )
                    splashOverlay.animate().alpha(0f).setDuration(300)
                        .withEndAction { splashOverlay.visibility = View.GONE }.start()
                }
                swipeRefresh.isRefreshing = false
                errorView.visibility = View.GONE
            }
            override fun onReceivedError(view: WebView?, req: WebResourceRequest?, err: WebResourceError?) {
                if (req?.isForMainFrame == true) showError()
            }
            override fun shouldOverrideUrlLoading(view: WebView?, req: WebResourceRequest?): Boolean {
                val u = req?.url?.toString() ?: return false
                if (!u.startsWith("file:///")) {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u)))
                    return true
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, p: Int) {
                progressBar.progress = p
                progressBar.visibility = if (p < 100) View.VISIBLE else View.GONE
            }
        }

        webView.addJavascriptInterface(NativeBridge(), "VDeleBridge")
    }

    private fun setupSwipeRefresh() {
        // Disabled: SwipeRefreshLayout interferes with page scrolling on Realme C75.
        // Pull-to-refresh is confusing in a single-page app.
        swipeRefresh.isEnabled = false
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })
    }

    private fun loadApp() {
        splashOverlay.visibility = View.VISIBLE
        splashOverlay.alpha = 1f
        errorView.visibility = View.GONE
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    private fun showError() {
        errorView.visibility = View.VISIBLE
        findViewById<View>(R.id.btn_retry).setOnClickListener { loadApp() }
    }

    override fun onResume() { super.onResume(); webView.onResume() }
    override fun onPause()  { super.onPause();  webView.onPause()  }
    override fun onDestroy(){ webView.destroy(); super.onDestroy()  }
}

class NativeBridge {
    @JavascriptInterface fun version(): String  = BuildConfig.VERSION_NAME
    @JavascriptInterface fun flavor(): String   = BuildConfig.ENTRY_PATH
}
