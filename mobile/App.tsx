import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

/* The app shows the same visit form that is published on GitHub Pages, so it talks to the same
   Google Sheet as the Admin console and Reports. The page's service worker keeps a copy for
   opening it without signal; visits are saved on the phone and sync when back online. */
const SITE = 'https://tarkeshstack.github.io/farmvisit/';
const FORM = SITE + 'index.html';

/* Runs inside the page: sends PDFs and backups to the phone's share sheet (an Android
   WebView cannot download blobs itself) and lets the back button close open panels. */
const BRIDGE = `(function(){
  function send(o){window.ReactNativeWebView.postMessage(JSON.stringify(o))}
  function sendBlob(name,blob){var r=new FileReader();r.onload=function(){var s=String(r.result);send({type:'file',name:name,mime:blob.type||'application/octet-stream',b64:s.slice(s.indexOf(',')+1)})};r.readAsDataURL(blob)}
  function patch(){
    if(typeof download==='function'&&!download.fv){var d=function(name,blob){sendBlob(name,blob)};d.fv=1;window.download=d}
    if(typeof takePhoto==='function'&&!takePhoto.fv){var tp=function(kind){if(kind!=='selfie'&&(D.photos||[]).length>=6){toast('Ek visit mein 6 photos tak le sakte hain.');return}send({type:'camera',kind:kind})};tp.fv=1;window.takePhoto=tp}   // an Android WebView cannot open the camera itself: the app does it
    window.print=function(){try{toast('To print, press Share and pick a printer')}catch(e){}};
  }
  if(!window.fvApp){
    window.fvApp=true;
    navigator.canShare=function(d){return !!(d&&d.files&&d.files.length)};
    navigator.share=function(d){sendBlob(d.files[0].name,d.files[0]);return Promise.resolve()};
    window.fvBack=function(){try{if(document.getElementById('rv')){closeReport();return}if(typeof SH!=='undefined'&&SH){closeSheet();return}}catch(e){}send({type:'exit'})};
    document.addEventListener('DOMContentLoaded',patch);window.addEventListener('load',patch);
  }
  patch();
})();true;`;

type Msg = { type: 'file'; name: string; mime: string; b64: string } | { type: 'camera'; kind: 'farm' | 'selfie' } | { type: 'exit' };

export default function App() {
  const web = useRef<WebView>(null);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      web.current?.injectJavaScript('window.fvBack&&fvBack();true;');
      return true;
    });
    return () => sub.remove();
  }, []);

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    let m: Msg;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'exit') { BackHandler.exitApp(); return; }
    if (m.type === 'camera') {
      const say = (t: string) => web.current?.injectJavaScript(`toast(${JSON.stringify(t)});true;`);
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { say('Camera ki permission chahiye: Phone Settings → Apps → Farm Visit → Permissions → Camera.'); return; }
        const r = await ImagePicker.launchCameraAsync({
          cameraType: m.kind === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
          quality: 0.4, base64: true, allowsEditing: false,
        });
        const a = r.canceled ? null : r.assets[0];
        if (!a || !a.base64) return;
        const uri = 'data:' + (a.mimeType || 'image/jpeg') + ';base64,' + a.base64;
        web.current?.injectJavaScript(`photoFromApp(${JSON.stringify(m.kind)},${JSON.stringify(uri)});true;`);
      } catch (e) { say('Camera nahi khul paya. Dobara try kijiye.'); }
      return;
    }
    if (m.type === 'file') {
      const name = m.name.replace(/[^\w.-]+/g, '_') || 'farm-visit-file';
      const f = new File(Paths.cache, name);
      if (f.exists) f.delete();
      f.create();
      f.write(m.b64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: m.mime, dialogTitle: name });
    }
  }, []);

  /* Stay on the visit form; Admin console, Reports and any other link open in the browser. */
  const onNav = useCallback((r: ShouldStartLoadRequest) => {
    const u = r.url;
    if (r.isTopFrame === false || !/^https?:/.test(u)) return true;
    if (u === SITE || u.startsWith(FORM)) return true;
    Linking.openURL(u.startsWith(SITE) ? u.split('?')[0] : u);
    return false;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        {failed ? (
          <View style={styles.center}>
            <Text style={styles.h}>No connection</Text>
            <Text style={styles.p}>Open the app once with internet so the visit form is saved on this phone. After that it opens without signal.</Text>
            <Pressable style={styles.btn} onPress={() => { setFailed(false); setKey(k => k + 1); }}>
              <Text style={styles.btnT}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            key={key}
            ref={web}
            source={{ uri: FORM }}
            style={styles.web}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
            setSupportMultipleWindows={false}
            applicationNameForUserAgent="FarmVisitApp/1.0"
            injectedJavaScriptBeforeContentLoaded={BRIDGE}
            injectedJavaScript={BRIDGE}
            onMessage={onMessage}
            onShouldStartLoadWithRequest={onNav}
            onError={() => setFailed(true)}
            startInLoadingState
            renderLoading={() => (
              <View style={[styles.center, StyleSheet.absoluteFill]}>
                <ActivityIndicator size="large" color="#f4b324" />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d2a25' },
  web: { flex: 1, backgroundColor: '#eef3f0' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#0d2a25' },
  h: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  p: { color: '#cfe0da', fontSize: 16, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  btn: { backgroundColor: '#0b7466', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  btnT: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
