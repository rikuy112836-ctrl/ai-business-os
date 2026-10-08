// TikFinity デスクトップアプリ（Windows）の Events API に接続して実際のライブのイベントを受け取る。
// 既定の接続先 ws://127.0.0.1:21213/（コミュニティ情報。TikFinity の設定画面で確認すること）
// ライブ配信中で、TikFinity が自分のアカウントに接続しているときだけイベントが届く。
export function startTikfinitySource({ url, onEvent, log = () => {}, onStatus = () => {} }) {
  let ws = null;
  let stopped = false;
  let retryMs = 2000;
  let timer = null;

  function connect() {
    if (stopped) return;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      log(`TikFinity 接続エラー: ${e.message}`);
      return schedule();
    }
    ws.onopen = () => {
      retryMs = 2000;
      onStatus('connected');
      log(`TikFinity に接続しました: ${url}`);
    };
    ws.onmessage = (msg) => {
      try {
        onEvent(JSON.parse(typeof msg.data === 'string' ? msg.data : msg.data.toString()));
      } catch {
        /* JSON でないメッセージは無視 */
      }
    };
    ws.onclose = () => {
      onStatus('disconnected');
      schedule();
    };
    ws.onerror = () => {};
  }

  function schedule() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, 30000);
  }

  connect();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      if (ws) ws.close();
    },
  };
}
