package com.cyberpunkdiario.offline;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebChromeClient.FileChooserParams;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.view.View;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;

public final class MainActivity extends Activity {
 private WebView web;
 private ValueCallback<Uri[]> chooser;
 private String backupPayload;
 private static final int PICK_JSON=501, SAVE_JSON=502;
 private final class BackupBridge {
  @JavascriptInterface public synchronized String loadSnapshot() {
   try {
    File file=new File(getFilesDir(),"cyberpunk-diario-state.json");
    if(!file.isFile() || file.length()>5000000)return "";
    try(FileInputStream input=new FileInputStream(file); ByteArrayOutputStream output=new ByteArrayOutputStream()) { byte[] buffer=new byte[8192]; int count; while((count=input.read(buffer))!=-1)output.write(buffer,0,count); return output.toString("UTF-8"); }
   } catch(Exception e) { return ""; }
  }
  @JavascriptInterface public synchronized void saveSnapshot(String json) {
   if(json==null || json.length()>5000000)return;
   File target=new File(getFilesDir(),"cyberpunk-diario-state.json");
   File temp=new File(getFilesDir(),"cyberpunk-diario-state.tmp");
   try(FileOutputStream output=new FileOutputStream(temp)) {
    output.write(json.getBytes(StandardCharsets.UTF_8));
    output.getFD().sync();
    if(target.exists()&&!target.delete())return;
    if(!temp.renameTo(target)) {
     try(FileOutputStream fallback=new FileOutputStream(target)) {
      fallback.write(json.getBytes(StandardCharsets.UTF_8));
      fallback.getFD().sync();
     }
     temp.delete();
    }
   } catch(Exception ignored) { temp.delete(); }
  }
  @JavascriptInterface public void save(String json) {
   if(json==null || json.length()>3000000)return;
   runOnUiThread(()->{ backupPayload=json; Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");
    intent.putExtra(Intent.EXTRA_TITLE,"cyberpunk-diario-backup.json");startActivityForResult(intent,SAVE_JSON);
   });
  }
 }
 @Override public void onCreate(Bundle saved){super.onCreate(saved);
  getWindow().setStatusBarColor(Color.rgb(10,10,14));getWindow().setNavigationBarColor(Color.rgb(10,10,14));
  web=new WebView(this);web.setBackgroundColor(Color.rgb(8,9,12));
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(true);web.getSettings().setAllowContentAccess(false);
  web.getSettings().setAllowFileAccessFromFileURLs(false);web.getSettings().setAllowUniversalAccessFromFileURLs(false);
  web.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
  web.addJavascriptInterface(new BackupBridge(),"AndroidBackup");
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(chooser!=null)chooser.onReceiveValue(null);
    chooser=callback;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");
    startActivityForResult(intent,PICK_JSON);return true;
   }
  });web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest req){
    Uri u=req.getUrl();if("file".equals(u.getScheme()))return false;
    if("https".equals(u.getScheme())||"http".equals(u.getScheme())){startActivity(new Intent(Intent.ACTION_VIEW,u));return true;}
    return true;
   }
  });
  setContentView(web);web.loadUrl("file:///android_asset/index.html");
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==PICK_JSON){if(chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);chooser=null;}return;}
  if(request==SAVE_JSON){if(result==RESULT_OK&&data!=null&&backupPayload!=null){
   try(java.io.OutputStream output=getContentResolver().openOutputStream(data.getData())){
    if(output!=null)output.write(backupPayload.getBytes(StandardCharsets.UTF_8));
   }catch(Exception e){android.widget.Toast.makeText(this,"Não foi possível salvar backup",android.widget.Toast.LENGTH_LONG).show();}
  }backupPayload=null;}
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}