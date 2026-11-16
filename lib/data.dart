import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

const Object _keep = Object();

class DiaryItem {
  final String id, kind, title, body;
  final int? dueAt, deletedAt;
  final bool done;
  final int updatedAt;
  const DiaryItem({required this.id,required this.kind,required this.title,required this.body,required this.dueAt,required this.done,required this.updatedAt,required this.deletedAt});
  DiaryItem copy({String? title,String? body,Object? dueAt=_keep,bool? done,int? updatedAt,Object? deletedAt=_keep}) => DiaryItem(
    id:id,kind:kind,title:title??this.title,body:body??this.body,
    dueAt:identical(dueAt,_keep)?this.dueAt:dueAt as int?,
    done:done??this.done,updatedAt:updatedAt??this.updatedAt,
    deletedAt:identical(deletedAt,_keep)?this.deletedAt:deletedAt as int?,
  );
  Map<String,Object?> toMap()=>{'id':id,'kind':kind,'title':title,'body':body,'due_at':dueAt,'done':done?1:0,'updated_at':updatedAt,'deleted_at':deletedAt};
  factory DiaryItem.fromMap(Map<String,Object?> m)=>DiaryItem(id:m['id'] as String,kind:m['kind'] as String,title:m['title'] as String,body:m['body'] as String? ?? '',dueAt:m['due_at'] as int?,done:(m['done'] as int? ?? 0)==1,updatedAt:m['updated_at'] as int? ?? 0,deletedAt:m['deleted_at'] as int?);
}
class DiaryDb {
  DiaryDb._();
  static final instance=DiaryDb._();
  Database? _db;
  Future<void> init() async {
    if(!kIsWeb&&(Platform.isWindows||Platform.isLinux||Platform.isMacOS)){sqfliteFfiInit();databaseFactory=databaseFactoryFfi;}
    final dir=await getApplicationSupportDirectory();await dir.create(recursive:true);
    _db=await openDatabase(join(dir.path,'cyberpunk_diary.db'),version:1,onCreate:(db,v) async {
      await db.execute('CREATE TABLE items(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,due_at INTEGER,done INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,deleted_at INTEGER)');
      await db.execute('CREATE INDEX items_due_at_idx ON items(due_at)');
      await db.execute('CREATE INDEX items_updated_at_idx ON items(updated_at)');
    });
  }
  Database get db {final value=_db;if(value==null)throw StateError('Database not initialized');return value;}
  Future<List<DiaryItem>> all({bool includeDeleted=true}) async => (await db.query('items',where:includeDeleted?null:'deleted_at IS NULL',orderBy:'updated_at DESC')).map(DiaryItem.fromMap).toList();
  Future<void> save(DiaryItem item) async {await db.insert('items',item.toMap(),conflictAlgorithm:ConflictAlgorithm.replace);}
  Future<void> saveAll(Iterable<DiaryItem> items) async {await db.transaction((tx) async {final batch=tx.batch();for(final item in items){batch.insert('items',item.toMap(),conflictAlgorithm:ConflictAlgorithm.replace);}await batch.commit(noResult:true);});}
}
