/* CYBERPUNK DIÁRIO // SYNC BRIDGE (v0.3)
 * The site works fully offline/local without any backend.
 * GitHub Actions publishes this static site; it is NOT an always-on API/database.
 * To enable multi-device sync, deploy an authenticated API (e.g. Supabase/Firebase/Cloudflare Worker).
 * Never embed a GitHub personal access token or admin/service-role key in browser code.
 * Replace CONFIG.endpoint with a real HTTPS API URL and implement authenticated GET/PUT.
 * Contract suggestion: GET /tasks -> {tasks, completed, accent, revision}
 *                      PUT /tasks -> {tasks, completed, accent, revision}
 * Resolve conflicts using revisions; do not overwrite local data without user confirmation.
 * PRIVATE tasks must be protected by server-side access controls, not by the UI label.
 */
(() => {
 'use strict';
 const CONFIG={endpoint:'',enabled:false};
 let changedAt=0;
 window.CyberpunkBridge={
   config:CONFIG,
   changed(snapshot){
     // Future integration point. Called each time local tasks change.
     changedAt=Date.now();
     window.dispatchEvent(new CustomEvent('cyberpunk:local-change',{detail:{timestamp:changedAt,count:snapshot.tasks.length}}));
   },
   async pull(){if(!CONFIG.enabled||!CONFIG.endpoint)throw new Error('Sincronização ainda não configurada');throw new Error('Configure autenticação e endpoint antes de implementar pull')},
   async push(){if(!CONFIG.enabled||!CONFIG.endpoint)throw new Error('Sincronização ainda não configurada');throw new Error('Configure autenticação e endpoint antes de implementar push')}
 };
})();
