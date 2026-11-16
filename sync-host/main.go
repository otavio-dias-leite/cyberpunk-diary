package main

import (
 "database/sql"
 "encoding/json"
 "log"
 "net/http"
 "os"
 "strings"
 "time"
 _ "modernc.org/sqlite"
)

type Item struct { ID string `json:"id"`; Kind string `json:"kind"`; Title string `json:"title"`; Body string `json:"body"`; DueAt *int64 `json:"due_at"`; Done int `json:"done"`; UpdatedAt int64 `json:"updated_at"`; DeletedAt *int64 `json:"deleted_at"` }
type Payload struct { Items []Item `json:"items"` }
var db *sql.DB
func main(){
 token:=os.Getenv("SYNC_TOKEN");if len(token)<24{log.Fatal("SYNC_TOKEN must contain at least 24 characters")}
 addr:=os.Getenv("SYNC_ADDR");if addr==""{addr="127.0.0.1:8787"}
 var err error;db,err=sql.Open("sqlite",env("SYNC_DB","cyberpunk-sync.db"));if err!=nil{log.Fatal(err)}
 _,err=db.Exec(`CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,kind TEXT,title TEXT,body TEXT,due_at INTEGER,done INTEGER,updated_at INTEGER,deleted_at INTEGER)`);if err!=nil{log.Fatal(err)}
 mux:=http.NewServeMux();mux.HandleFunc("/health",func(w http.ResponseWriter,r *http.Request){w.Write([]byte("ok"))});mux.HandleFunc("/v1/sync",syncHandler)
 log.Printf("sync host listening on %s",addr);log.Fatal(http.ListenAndServe(addr,security(mux,token)))
}
func env(k,d string)string{if v:=os.Getenv(k);v!=""{return v};return d}
func security(next http.Handler,token string)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");w.Header().Set("Cache-Control","no-store");if r.Method==http.MethodOptions{w.WriteHeader(204);return};if r.Header.Get("Authorization")!="Bearer "+token{http.Error(w,"unauthorized",401);return};next.ServeHTTP(w,r)})}
func syncHandler(w http.ResponseWriter,r *http.Request){
 if r.Method!=http.MethodPost{http.Error(w,"method not allowed",405);return}
 r.Body=http.MaxBytesReader(w,r.Body,8<<20);defer r.Body.Close()
 var in Payload;if err:=json.NewDecoder(r.Body).Decode(&in);err!=nil{http.Error(w,"invalid payload",400);return}
 tx,err:=db.Begin();if err!=nil{http.Error(w,"database unavailable",500);return};defer tx.Rollback()
 stmt,err:=tx.Prepare(`INSERT INTO items(id,kind,title,body,due_at,done,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,body=excluded.body,due_at=excluded.due_at,done=excluded.done,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at`)
 if err!=nil{http.Error(w,"database error",500);return};defer stmt.Close()
 for _,v:=range in.Items{
  if strings.TrimSpace(v.ID)==""{continue}
  var current Item
  scanErr:=tx.QueryRow(`SELECT id,kind,title,body,due_at,done,updated_at,deleted_at FROM items WHERE id=?`,v.ID).Scan(&current.ID,&current.Kind,&current.Title,&current.Body,&current.DueAt,&current.Done,&current.UpdatedAt,&current.DeletedAt)
  if scanErr!=nil && scanErr!=sql.ErrNoRows{http.Error(w,"read failed",500);return}
  shouldWrite:=scanErr==sql.ErrNoRows || v.UpdatedAt>current.UpdatedAt
  if scanErr==nil && v.UpdatedAt==current.UpdatedAt{
   incomingJSON,_:=json.Marshal(v);currentJSON,_:=json.Marshal(current)
   shouldWrite=string(incomingJSON)>string(currentJSON)
  }
  if shouldWrite{if _,err=stmt.Exec(v.ID,v.Kind,v.Title,v.Body,v.DueAt,v.Done,v.UpdatedAt,v.DeletedAt);err!=nil{http.Error(w,"write failed",500);return}}
 }
 if err=tx.Commit();err!=nil{http.Error(w,"commit failed",500);return}
 rows,err:=db.Query(`SELECT id,kind,title,body,due_at,done,updated_at,deleted_at FROM items`);if err!=nil{http.Error(w,"read failed",500);return};defer rows.Close()
 out:=Payload{Items:[]Item{}};for rows.Next(){var v Item;if err=rows.Scan(&v.ID,&v.Kind,&v.Title,&v.Body,&v.DueAt,&v.Done,&v.UpdatedAt,&v.DeletedAt);err!=nil{http.Error(w,"read failed",500);return};out.Items=append(out.Items,v)}
 w.Header().Set("Content-Type","application/json");_ = json.NewEncoder(w).Encode(out)
}
var _ = time.Now
