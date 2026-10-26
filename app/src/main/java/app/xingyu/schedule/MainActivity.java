package app.xingyu.schedule;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ToggleButton;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Local timetable UI and a separate, unprivileged school browser. No third-party SDKs. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    private static final int PICK_BACKGROUND = 10, PICK_IMPORT = 11, SAVE_BACKUP = 12;
    private WebView appView, schoolView;
    private FrameLayout root;
    private LinearLayout schoolPanel;
    private TextView schoolAddress;
    private ToggleButton desktopToggle;
    private Button captureButton;
    private boolean desktopMode;
    private String mobileUserAgent;
    private String pendingExport = "";
    private int insetTop, insetBottom;
    private boolean darkTheme;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        desktopMode=getSharedPreferences("browser",MODE_PRIVATE).getBoolean("desktop_mode",true);
        // 全面屏：壁纸铺到状态栏和手势条下面，系统栏高度交给网页用 CSS 变量自己留白。
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= 29) { getWindow().setStatusBarContrastEnforced(false); getWindow().setNavigationBarContrastEnforced(false); }
        if (android.os.Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(247,245,253));
        root.setOnApplyWindowInsetsListener((v,insets)->{
            int left,top,right,bottom,ime;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left=bars.left;top=bars.top;right=bars.right;bottom=bars.bottom;ime=insets.getInsets(WindowInsets.Type.ime()).bottom;
            } else {
                left=insets.getSystemWindowInsetLeft();top=insets.getSystemWindowInsetTop();right=insets.getSystemWindowInsetRight();bottom=insets.getStableInsetBottom();
                ime=insets.getSystemWindowInsetBottom()>bottom?insets.getSystemWindowInsetBottom():0;
            }
            // 键盘弹出时整页上移到键盘之上（相当于 adjustResize），此时网页底部不用再给手势条留白。
            v.setPadding(left,0,right,ime);
            insetTop=top;insetBottom=ime>0?0:bottom;
            if(schoolPanel!=null)schoolPanel.setPadding(0,top,0,ime>0?0:bottom);
            pushInsets();
            return insets;
        });
        setContentView(root);
        appView = new WebView(this);
        appView.setBackgroundColor(Color.TRANSPARENT);
        WebSettings settings = appView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // 本地界面固定缩放：双指缩放、双击缩放和文字缩放全部关掉，避免误触把布局放大。
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        appView.addJavascriptInterface(new LocalBridge(), "Native");
        appView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !isLocal(request.getUrl()); }
            @Override public void onPageFinished(WebView view, String url) { pushInsets(); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if(!isLocal(uri))return response("text/plain",new byte[0]);
                String path=uri.getPath();
                try {
                    if("/wallpaper".equals(path))return new WebResourceResponse("image/jpeg",null,new FileInputStream(new File(getFilesDir(),"wallpaper.jpg")));
                    if(path==null||path.contains(".."))return response("text/plain",new byte[0]);
                    String name=path.substring(1);
                    return new WebResourceResponse(mime(name),"UTF-8",getAssets().open(name));
                }catch(Exception e){return response("text/plain",new byte[0]);}
            }
        });
        root.addView(appView,new FrameLayout.LayoutParams(-1,-1));
        appView.loadUrl("https://"+ORIGIN+"/index.html");
    }
    private boolean isLocal(Uri u){return "https".equals(u.getScheme())&&ORIGIN.equals(u.getHost());}
    private static WebResourceResponse response(String type,byte[] content){return new WebResourceResponse(type,"UTF-8",new ByteArrayInputStream(content));}
    private static String mime(String p){if(p.endsWith(".js"))return "application/javascript";if(p.endsWith(".css"))return "text/css";if(p.endsWith(".jpg"))return "image/jpeg";if(p.endsWith(".png"))return "image/png";if(p.endsWith(".svg"))return "image/svg+xml";return "text/html";}
    private void notifyJs(String function,String value){appView.evaluateJavascript("window."+function+"&&window."+function+"("+JSONObject.quote(value)+")",null);}
    private void message(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
    private String insetsText(){float d=getResources().getDisplayMetrics().density;return Math.round(insetTop/d)+","+Math.round(insetBottom/d);}
    private void pushInsets(){if(appView!=null)appView.evaluateJavascript("window.applyInsets&&window.applyInsets('"+insetsText()+"')",null);}
    private void setDarkBars(boolean dark){setDarkBars(dark,dark);}
    /** dark=true 表示背景是深色，系统栏图标用白色。弹层打开时页面顶部变暗，只把状态栏换成白色图标。 */
    private void setDarkBars(boolean statusDark,boolean navDark){
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            int status=android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,nav=android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            getWindow().getInsetsController().setSystemBarsAppearance((statusDark?0:status)|(navDark?0:nav),status|nav);
        } else {
            int flags=View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            getWindow().getDecorView().setSystemUiVisibility(flags|(statusDark?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)|(navDark?0:View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR));
        }
        root.setBackgroundColor(navDark?Color.rgb(20,18,32):Color.rgb(247,245,253));
    }
    private int hapticConstant(String kind){
        int sdk=android.os.Build.VERSION.SDK_INT;
        if("confirm".equals(kind))return sdk>=30?HapticFeedbackConstants.CONFIRM:HapticFeedbackConstants.CONTEXT_CLICK;
        if("reject".equals(kind))return sdk>=30?HapticFeedbackConstants.REJECT:HapticFeedbackConstants.LONG_PRESS;
        if("soft".equals(kind))return sdk>=34?HapticFeedbackConstants.SEGMENT_FREQUENT_TICK:HapticFeedbackConstants.CLOCK_TICK;
        return sdk>=34?HapticFeedbackConstants.SEGMENT_TICK:HapticFeedbackConstants.CLOCK_TICK;
    }
    private byte[] readLimited(InputStream in,int limit)throws Exception{try(InputStream stream=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=stream.read(b))!=-1){if(out.size()+n>limit)throw new Exception("文件过大，请选择小于 "+(limit/1024/1024)+" MB 的文件");out.write(b,0,n);}return out.toByteArray();}}
    private String assetText(String name)throws Exception{return new String(readLimited(getAssets().open(name),2*1024*1024),StandardCharsets.UTF_8);}

    public final class LocalBridge {
        @JavascriptInterface public String getState(){return getSharedPreferences("timetable",MODE_PRIVATE).getString("state","");}
        @JavascriptInterface public String getImportBackup(){return getSharedPreferences("timetable",MODE_PRIVATE).getString("before_import","");}
        @JavascriptInterface public boolean backupBeforeImport(String value){try{if(value.length()>2*1024*1024)return false;new JSONObject(value);return getSharedPreferences("timetable",MODE_PRIVATE).edit().putString("before_import",value).commit();}catch(Exception e){return false;}}
        @JavascriptInterface public boolean saveState(String value){try{if(value.length()>2*1024*1024)return false;JSONObject data=new JSONObject(value);// 0.3.0+ stores several timetables; older builds kept a flat courses array.
            if(!data.has("settings")||(!data.has("timetables")&&!data.has("courses")))return false;return getSharedPreferences("timetable",MODE_PRIVATE).edit().putString("state",value).commit();}catch(Exception e){return false;}}
        @JavascriptInterface public void pickBackground(){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("image/*");intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,PICK_BACKGROUND);});}
        @JavascriptInterface public void pickImportFile(){runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("*/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/*","application/octet-stream"});intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,PICK_IMPORT);});}
        @JavascriptInterface public void exportBackup(String data){runOnUiThread(()->{if(data.length()>2*1024*1024){message("备份过大");return;}pendingExport=data;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,"星屿课表-备份.json");startActivityForResult(intent,SAVE_BACKUP);});}
        @JavascriptInterface public void openSchool(String url){runOnUiThread(()->showSchool(url));}
        @JavascriptInterface public String insets(){return insetsText();}
        @JavascriptInterface public void systemBars(boolean dark,boolean sheetOpen){runOnUiThread(()->{darkTheme=dark;if(schoolPanel==null||schoolPanel.getVisibility()!=View.VISIBLE)setDarkBars(dark||sheetOpen,dark);});}
        @JavascriptInterface public void haptic(String kind){runOnUiThread(()->appView.performHapticFeedback(hapticConstant(kind)));}
        @JavascriptInterface public void clearSchoolSession(){runOnUiThread(()->{if(schoolView!=null){root.removeView(schoolPanel);schoolView.clearCache(true);schoolView.clearHistory();schoolView.destroy();schoolView=null;schoolPanel=null;}CookieManager.getInstance().removeAllCookies(ok->message("教务网站登录状态已清除"));android.webkit.WebStorage.getInstance().deleteAllData();});}
    }
    private boolean validWebUrl(String text){try{Uri u=Uri.parse(text);return ("https".equals(u.getScheme())||"http".equals(u.getScheme()))&&u.getHost()!=null&&u.getUserInfo()==null;}catch(Exception e){return false;}}
    private Button button(String label){Button b=new Button(this);b.setText(label);b.setTextSize(13);b.setAllCaps(false);return b;}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private void showSchool(String url){
        if(!validWebUrl(url)){message("请输入完整的 http:// 或 https:// 教务网址");return;}
        if(schoolPanel==null){
            schoolPanel=new LinearLayout(this);schoolPanel.setOrientation(LinearLayout.VERTICAL);schoolPanel.setBackgroundColor(Color.WHITE);
            LinearLayout bar=new LinearLayout(this);bar.setOrientation(LinearLayout.HORIZONTAL);bar.setPadding(dp(4),0,dp(4),0);
            Button close=button("返回"),refresh=button("刷新");captureButton=button("识别课表");
            desktopToggle=new ToggleButton(this);desktopToggle.setTextOn("桌面模式：开");desktopToggle.setTextOff("桌面模式：关");desktopToggle.setChecked(desktopMode);desktopToggle.setTextSize(11);desktopToggle.setAllCaps(false);desktopToggle.setMinWidth(0);desktopToggle.setPadding(dp(4),0,dp(4),0);desktopToggle.setContentDescription("桌面模式");
            bar.addView(close,new LinearLayout.LayoutParams(dp(56),dp(48)));bar.addView(refresh,new LinearLayout.LayoutParams(dp(56),dp(48)));bar.addView(desktopToggle,new LinearLayout.LayoutParams(dp(116),dp(48)));bar.addView(captureButton,new LinearLayout.LayoutParams(0,dp(48),1));
            close.setOnClickListener(v->hideSchool());refresh.setOnClickListener(v->schoolView.reload());captureButton.setOnClickListener(v->captureSchool());
            desktopToggle.setOnCheckedChangeListener((button,checked)->{desktopMode=checked;getSharedPreferences("browser",MODE_PRIVATE).edit().putBoolean("desktop_mode",checked).apply();if(schoolView!=null){schoolView.stopLoading();applySchoolBrowserMode();schoolView.reload();message(checked?"桌面模式已开启，当前页面会重新加载":"已切换手机模式，当前页面会重新加载");}});
            schoolPanel.addView(bar);
            TextView hint=new TextView(this);hint.setText("登录 → 打开整学期课表（个人课表 / 学生课表）→ 识别。排版不全时开启桌面模式，可双指缩放；切换模式会刷新页面。");hint.setTextSize(12);hint.setTextColor(Color.rgb(97,83,147));hint.setPadding(dp(12),dp(6),dp(12),dp(6));schoolPanel.addView(hint);
            schoolAddress=new TextView(this);schoolAddress.setTextSize(11);schoolAddress.setPadding(16,4,16,10);schoolAddress.setMaxLines(2);schoolPanel.addView(schoolAddress);
            schoolAddress.setOnClickListener(v->{EditText edit=new EditText(this);edit.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);edit.setText(schoolView.getUrl());new AlertDialog.Builder(this).setTitle("前往教务网址").setView(edit).setPositiveButton("前往",(d,w)->{String next=edit.getText().toString().trim();if(validWebUrl(next))schoolView.loadUrl(next);else message("网址无效");}).setNegativeButton("取消",null).show();});
            schoolView=new WebView(this);
            WebSettings s=schoolView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);s.setSupportZoom(true);s.setBuiltInZoomControls(true);s.setDisplayZoomControls(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSafeBrowsingEnabled(true);
            mobileUserAgent=s.getUserAgentString();applySchoolBrowserMode();
            // No JavascriptInterface is attached to schoolView. Login pages cannot reach local app data.
            CookieManager.getInstance().setAcceptCookie(true);
            schoolView.setWebViewClient(new WebViewClient(){
                @Override public void onPageStarted(WebView view,String next,Bitmap icon){captureButton.setEnabled(false);}
                @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !validWebUrl(request.getUrl().toString());}
                @Override public void onPageFinished(WebView view,String next){Uri u=Uri.parse(next);schoolAddress.setText((desktopMode?"电脑版 · ":"手机版 · ")+("http".equals(u.getScheme())?"HTTP 未加密 · ":"")+u.getHost()+"（点击可更换网址）");CookieManager.getInstance().flush();if(desktopMode){try{view.evaluateJavascript(assetText("desktop-viewport.js"),result->captureButton.setEnabled(true));}catch(Exception e){captureButton.setEnabled(true);}}else captureButton.setEnabled(true);}
                @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error){handler.cancel();message("网站证书验证失败，连接已停止。请确认官方入口或学校 VPN。");}
            });
            schoolView.setWebChromeClient(new WebChromeClient());
            schoolPanel.addView(schoolView,new LinearLayout.LayoutParams(-1,0,1));root.addView(schoolPanel,new FrameLayout.LayoutParams(-1,-1));
            schoolPanel.setPadding(0,insetTop,0,insetBottom);
        }
        // 教务浏览器是白底，状态栏图标要用深色。
        setDarkBars(false);schoolPanel.setVisibility(View.VISIBLE);schoolView.loadUrl(url);
    }
    private void applySchoolBrowserMode(){
        WebSettings s=schoolView.getSettings();
        String desktopUserAgent=mobileUserAgent.replaceFirst("\\([^)]*\\)","(X11; Linux x86_64)").replace("Version/4.0 ","").replace("Mobile ","");
        s.setUserAgentString(desktopMode?desktopUserAgent:mobileUserAgent);
        s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);s.setTextZoom(100);s.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);schoolView.setInitialScale(0);
    }
    private void hideSchool(){if(schoolPanel!=null)schoolPanel.setVisibility(View.GONE);setDarkBars(darkTheme);}
    private void captureSchool(){
        try{schoolView.evaluateJavascript(assetText("extract.js"),raw->{
            try{Object result=new JSONTokener(raw).nextValue();if(!(result instanceof String))throw new Exception("页面暂不支持识别");String text=(String)result;if(text.length()>2*1024*1024)throw new Exception("页面过大，请进入个人课表页面");new JSONObject(text);hideSchool();notifyJs("receiveSchoolSnapshot",text);}catch(Exception e){message("识别失败："+e.getMessage());}
        });}catch(Exception e){message("识别工具加载失败");}
    }
    @Override protected void onActivityResult(int request,int result,Intent intent){
        super.onActivityResult(request,result,intent);if(result!=RESULT_OK||intent==null||intent.getData()==null)return;Uri uri=intent.getData();
        if(request==PICK_BACKGROUND){new Thread(()->{
            try{
                BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;try(InputStream in=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,bounds);}
                if(bounds.outWidth<=0||bounds.outHeight<=0)throw new Exception("图片格式不支持");
                BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;while(Math.max(bounds.outWidth,bounds.outHeight)/options.inSampleSize>2400)options.inSampleSize*=2;
                Bitmap bitmap;try(InputStream in=getContentResolver().openInputStream(uri)){bitmap=BitmapFactory.decodeStream(in,null,options);}if(bitmap==null)throw new Exception("图片无法读取");
                File dest=new File(getFilesDir(),"wallpaper.jpg");try(FileOutputStream out=new FileOutputStream(dest)){bitmap.compress(Bitmap.CompressFormat.JPEG,90,out);}bitmap.recycle();runOnUiThread(()->notifyJs("receiveBackground","ok"));
            }catch(Exception e){runOnUiThread(()->message("背景未更换："+e.getMessage()));}
        },"wallpaper-import").start();}
        if(request==PICK_IMPORT){new Thread(()->{try{String text=new String(readLimited(getContentResolver().openInputStream(uri),2*1024*1024),StandardCharsets.UTF_8);runOnUiThread(()->notifyJs("receiveImportFile",text));}catch(Exception e){runOnUiThread(()->message("导入失败："+e.getMessage()));}},"file-import").start();}
        if(request==SAVE_BACKUP){String content=pendingExport;pendingExport="";new Thread(()->{try(OutputStream out=getContentResolver().openOutputStream(uri)){out.write(content.getBytes(StandardCharsets.UTF_8));runOnUiThread(()->message("备份已保存到你选择的位置"));}catch(Exception e){runOnUiThread(()->message("备份未保存，请重试"));}},"backup-export").start();}
    }
    @Override public void onBackPressed(){if(schoolPanel!=null&&schoolPanel.getVisibility()==View.VISIBLE){if(schoolView.canGoBack())schoolView.goBack();else hideSchool();return;}appView.evaluateJavascript("window.handleNativeBack?window.handleNativeBack():false",result->{if(!"true".equals(result))super.onBackPressed();});}
    @Override protected void onDestroy(){if(schoolView!=null)schoolView.destroy();if(appView!=null){appView.removeJavascriptInterface("Native");appView.destroy();}super.onDestroy();}
}
