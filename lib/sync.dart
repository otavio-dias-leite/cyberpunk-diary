import 'dart:convert';
import 'package:http/http.dart' as http;
import 'data.dart';

class SyncService {
  final String base,token;
  SyncService(this.base,this.token);
  String _fingerprint(DiaryItem item)=>jsonEncode(item.toMap());
  bool _newer(DiaryItem incoming,DiaryItem? current){
    if(current==null)return true;
    if(incoming.updatedAt!=current.updatedAt)return incoming.updatedAt>current.updatedAt;
    return _fingerprint(incoming).compareTo(_fingerprint(current))>0;
  }
  Future<List<DiaryItem>> sync(List<DiaryItem> local,Future<void> Function(DiaryItem) save) async {
    if(base.trim().isEmpty||token.trim().length<24)throw ArgumentError('Informe o host e um token com pelo menos 24 caracteres.');
    final parsed=Uri.tryParse(base.trim());
    if(parsed==null||!parsed.hasAuthority||!const ['http','https'].contains(parsed.scheme))throw ArgumentError('URL inválida. Use http:// ou https://.');
    final response=await http.post(parsed.resolve('/v1/sync'),headers:{'Authorization':'Bearer ${token.trim()}','Content-Type':'application/json','Accept':'application/json'},body:jsonEncode({'items':local.map((e)=>e.toMap()).toList()})).timeout(const Duration(seconds:30));
    if(response.statusCode!=200)throw Exception('HTTP ${response.statusCode}: ${response.body}');
    final decoded=jsonDecode(response.body);
    if(decoded is! Map<String,dynamic>||decoded['items'] is! List)throw const FormatException('Resposta de sincronização inválida.');
    final byId={for(final item in local)item.id:item};
    final merged=<DiaryItem>[];
    for(final raw in decoded['items'] as List){
      if(raw is! Map)continue;
      final incoming=DiaryItem.fromMap(Map<String,Object?>.from(raw));
      final current=byId[incoming.id];
      if(_newer(incoming,current)){await save(incoming);byId[incoming.id]=incoming;}
      merged.add(byId[incoming.id]??incoming);
    }
    return merged;
  }
}
