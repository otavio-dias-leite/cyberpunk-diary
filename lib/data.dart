import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';

class DiaryItem {
  final String id,kind,title,body; final int? dueAt,deletedAt; final bool done; final int updatedAt;
  const DiaryItem({required this.id,required this.kind,required this.title,required this.body,required this.dueAt,required this.done,required this.updatedAt,required this.deletedAt});
  DiaryItem copy({String? title,String? body,int? dueAt,bool? done,int? updatedAt,int? deletedAt})=>DiaryItem(id:id,kind:kind,title:title??this.title,body:body??this.body,dueAt:dueAt??this.dueAt,done:done??this.done,updatedAt:updatedAt??this.updatedAt,deletedAt:deletedAt??this.deletedAt);
  Map<String,Object?> toMap()=>{'id':id,'kind':kind,'title':title,'body':body,'due_at':dueAt,'done':done?1:0,'updated_at':updatedAt,'deleted_at':deletedAt};
  factory DiaryItem.fromMap(Map<String,Object?> m)=>DiaryItem(id:m['id'] as String,kind:m['kind'] as String,title:m['title'] as String,body:m['body'] as String,dueAt:m['due_at'] as int?,done:(m['done'] as int)==1,updatedAt:m['updated_at'] as int,deletedAt:m['deleted_at'] as int?);
}
class DiaryDb {
  DiaryDb._(); static final instance=DiaryDb._(); Database? _db;
  Future<void> init() async {
    if(!kIsWeb && (Platform.isWindows||Platform.isLinux||Platform.isMacOS)){sqfliteFfiInit();databaseFactory=databaseFactoryFfi;}
    final dir=await getApplicationSupportDirectory();await dir.create(recursive:true);
    _db=await openDatabase(join(dir.path,'cyberpunk_diary.db'),version:1,onCreate:(db,v)=>db.execute('CREATE TABLE items(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,due_at INTEGER,done INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)'));
  }
  Database get db=>_db!;
  Future<List<DiaryItem>> all() async =>(await db.query('items')).map(DiaryItem.fromMap).toList();
  Future<void> save(DiaryItem item) async {await db.insert('items',item.toMap(),conflictAlgorithm:ConflictAlgorithm.replace);}
}
