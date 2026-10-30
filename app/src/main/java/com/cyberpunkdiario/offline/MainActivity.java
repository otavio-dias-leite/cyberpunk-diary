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
import android.content.ContentValues;
import android.content.ContentUris;
import android.database.Cursor;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.wifi.WifiManager;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import org.json.JSONArray;
import org.json.JSONObject;
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
  @JavascriptInterface public void setThemeIcon(String theme) {
   String[] themes={"red","matrix","carbon","midnight","soulkiller","mono"};
   android.content.SharedPreferences prefs=getSharedPreferences("launcher_theme",MODE_PRIVATE);
   if(theme!=null && theme.equalsIgnoreCase(prefs.getString("theme","")))return;
   String[] aliases={"IconRed","IconMatrix","IconCarbon","IconMidnight","IconSoulkiller","IconMono"};
   int selected=0; for(int i=0;i<themes.length;i++)if(themes[i].equalsIgnoreCase(theme)){selected=i;break;}
   PackageManager pm=getPackageManager();
   for(int i=0;i<aliases.length;i++){
    ComponentName component=new ComponentName(getPackageName(),getPackageName()+"."+aliases[i]);
    pm.setComponentEnabledSetting(component,i==selected?PackageManager.COMPONENT_ENABLED_STATE_ENABLED:PackageManager.COMPONENT_ENABLED_STATE_DISABLED,PackageManager.DONT_KILL_APP);
   }
   prefs.edit().putString("theme",themes[selected]).apply();
  }
  @JavascriptInterface public void discoverDevicesAsync(String requestId) {
    new Thread(()->{
     String result=discoverDevices();
     runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.__cyberpunkDiscoveryResult&&window.__cyberpunkDiscoveryResult("+JSONObject.quote(requestId)+","+JSONObject.quote(result)+")",null);});
    },"cyberpunk-lan-discovery").start();
   }
   @JavascriptInterface public String discoverDevices() {
    JSONArray found=new JSONArray();WifiManager.MulticastLock multicastLock=null;
    try {
     WifiManager wifi=(WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);
     if(wifi!=null){multicastLock=wifi.createMulticastLock("CyberpunkDiarioDiscovery");multicastLock.setReferenceCounted(false);multicastLock.acquire();}
     try(DatagramSocket socket=new DatagramSocket()) {
      socket.setBroadcast(true);socket.setSoTimeout(250);
      String model=android.os.Build.MODEL==null?"Android":android.os.Build.MODEL.replace("|"," ").replace("\\n"," ");
      byte[] query=("CYBERPUNK_DISCOVER_V1|"+model).getBytes(StandardCharsets.UTF_8);
      for(int attempt=0;attempt<2;attempt++) {
       socket.send(new DatagramPacket(query,query.length,InetAddress.getByName("255.255.255.255"),8766));
       long until=System.currentTimeMillis()+900;
       while(System.currentTimeMillis()<until) {
        try {
         byte[] buffer=new byte[1024];DatagramPacket packet=new DatagramPacket(buffer,buffer.length);socket.receive(packet);
         String response=new String(packet.getData(),0,packet.getLength(),StandardCharsets.UTF_8);
         if(!response.startsWith("CYBERPUNK_DEVICE_V1|"))continue;
         String[] parts=response.split("\\\\|",4);if(parts.length<4)continue;
         String host=packet.getAddress().getHostAddress(),name=parts[1];boolean duplicate=false;
         for(int i=0;i<found.length();i++)if(host.equals(found.getJSONObject(i).optString("host")))duplicate=true;
         if(!duplicate){JSONObject device=new JSONObject();device.put("name",name);device.put("host",host);device.put("url","http://"+host+":"+parts[2]);device.put("platform","WINDOWS");device.put("id",parts[3]);found.put(device);}
        } catch(SocketTimeoutException timeout) { /* Continue listening until this discovery window expires. */ }
       }
      }
     }
    } catch(Exception ignored) {
    } finally {if(multicastLock!=null&&multicastLock.isHeld())try{multicastLock.release();}catch(Exception ignored){}}
    return found.toString();
   }
  @JavascriptInterface public synchronized String loadSnapshot() {
   String shared=readSharedSnapshot(); if(!shared.isEmpty())return shared;
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
    output.write(json.getBytes(StandardCharsets.UTF_8)); output.getFD().sync();
    if(target.exists()&&!target.delete())return;
    if(!temp.renameTo(target)) {
     try(FileOutputStream fallback=new FileOutputStream(target)) { fallback.write(json.getBytes(StandardCharsets.UTF_8)); fallback.getFD().sync(); }
     temp.delete();
    }
   } catch(Exception ignored) { temp.delete(); }
   writeSharedSnapshot(json);
  }
  @JavascriptInterface public void save(String json) {
   if(json==null || json.length()>3000000)return;
   runOnUiThread(()->{ backupPayload=json; Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");
    intent.putExtra(Intent.EXTRA_TITLE,"cyberpunk-diario-backup.json");startActivityForResult(intent,SAVE_JSON);
   });
  }
 }
 private static final String BACKUP_PREFIX="cyberpunk-diario-backup-";
 private static final String BACKUP_PATH=Environment.DIRECTORY_DOWNLOADS+"/CyberpunkDiario/";
 private String readSharedSnapshot() {
  if(Build.VERSION.SDK_INT<29)return "";
  String selection=MediaStore.MediaColumns.RELATIVE_PATH+"=? AND "+MediaStore.MediaColumns.DISPLAY_NAME+" LIKE ?";
  String[] args={BACKUP_PATH,BACKUP_PREFIX+"%.json"};
  try(Cursor cursor=getContentResolver().query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,null,selection,args,MediaStore.MediaColumns.DATE_MODIFIED+" DESC")) {
   if(cursor==null)return "";
   while(cursor.moveToNext()) {
    Uri uri=ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI,cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)));
    try(java.io.InputStream input=getContentResolver().openInputStream(uri);ByteArrayOutputStream output=new ByteArrayOutputStream()) {
     if(input==null)continue;byte[] buffer=new byte[8192];int count,total=0;
     while((count=input.read(buffer))!=-1){total+=count;if(total>5000000)break;output.write(buffer,0,count);}
     if(total<=5000000){String json=output.toString("UTF-8");try{new JSONObject(json);return json;}catch(Exception invalid){android.util.Log.w("CyberpunkBackup","Backup inválido; tentando a cópia anterior",invalid);}}
    } catch(Exception ignored) {}
   }
  } catch(Exception e){android.util.Log.w("CyberpunkBackup","Não foi possível ler backup compartilhado",e);}
  return "";
 }
 private void writeSharedSnapshot(String json) {
  if(Build.VERSION.SDK_INT<29)return;
  Uri created=null;
  try {
   ContentValues values=new ContentValues();
   values.put(MediaStore.MediaColumns.DISPLAY_NAME,BACKUP_PREFIX+System.currentTimeMillis()+".json");
   values.put(MediaStore.MediaColumns.MIME_TYPE,"application/json");
   values.put(MediaStore.MediaColumns.RELATIVE_PATH,BACKUP_PATH);
   values.put(MediaStore.MediaColumns.IS_PENDING,1);
   created=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
   if(created==null)return;
   try(java.io.OutputStream output=getContentResolver().openOutputStream(created,"w")) {
    if(output==null)throw new java.io.IOException("Não foi possível abrir o backup");
    output.write(json.getBytes(StandardCharsets.UTF_8));output.flush();
   }
   ContentValues ready=new ContentValues();ready.put(MediaStore.MediaColumns.IS_PENDING,0);
   getContentResolver().update(created,ready,null,null);
   pruneSharedBackups();
  } catch(Exception e) {
   if(created!=null)try{getContentResolver().delete(created,null,null);}catch(Exception ignored){}
   android.util.Log.w("CyberpunkBackup","Falha ao gravar backup compartilhado",e);
  }
 }
 private void pruneSharedBackups() {
  String selection=MediaStore.MediaColumns.RELATIVE_PATH+"=? AND "+MediaStore.MediaColumns.DISPLAY_NAME+" LIKE ?";
  String[] args={BACKUP_PATH,BACKUP_PREFIX+"%.json"};
  try(Cursor cursor=getContentResolver().query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,new String[]{MediaStore.MediaColumns._ID},selection,args,MediaStore.MediaColumns.DATE_MODIFIED+" DESC")) {
   if(cursor==null)return;int keep=0;
   while(cursor.moveToNext()){long id=cursor.getLong(0);if(keep++>=3)getContentResolver().delete(ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI,id),null,null);}
  } catch(Exception e){android.util.Log.w("CyberpunkBackup","Falha ao limpar backups antigos",e);}
 }
 @Override public void onCreate(Bundle saved){super.onCreate(saved);
  getWindow().setStatusBarColor(Color.rgb(10,10,14));getWindow().setNavigationBarColor(Color.rgb(10,10,14));
  web=new WebView(this);web.setBackgroundColor(Color.rgb(8,9,12));
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setSupportZoom(false);web.getSettings().setBuiltInZoomControls(false);web.getSettings().setDisplayZoomControls(false);web.getSettings().setTextZoom(100);
  web.getSettings().setAllowFileAccess(true);web.getSettings().setAllowContentAccess(false);
  web.setOverScrollMode(View.OVER_SCROLL_NEVER);web.setVerticalScrollBarEnabled(false);web.setHorizontalScrollBarEnabled(false);
  web.setFocusable(true);web.setFocusableInTouchMode(true);
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
 @Override protected void onPause(){if(web!=null)web.evaluateJavascript("window.__cyberpunkBackupNow&&window.__cyberpunkBackupNow()",null);super.onPause();}
 private void finishFromBack(){super.onBackPressed();}
 @Override public void onBackPressed(){if(web==null){finishFromBack();return;}web.evaluateJavascript("(function(){return !!(window.__cyberpunkHandleBack&&window.__cyberpunkHandleBack())})()",value->{if(!"true".equals(value))finishFromBack();});}
 @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}