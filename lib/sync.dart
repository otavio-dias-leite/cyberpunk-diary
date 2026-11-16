import 'dart:convert';
import 'package:http/http.dart' as http;
import 'data.dart';

class SyncService {
  final String base,token;
  SyncService(this.base,this.token);
  Future<void> sync(List<DiaryItem> local,Future<void> Function(DiaryItem) save) async {
    if(base.isEmpty||token.isEmpty) throw Exception('Informe host e token');
    final uri=Uri.parse(base.endsWith('/')?base.substring(0,base.length-1):base);
    final headers={'Authorization':'Bearer $token','Content-Type':'application/json'};
    final response=await http.post(uri.resolve('/v1/sync'),headers:headers,body:jsonEncode({'items':local.map((e)=>e.toMap()).toList()})).timeout(const Duration(seconds:20));
    if(response.statusCode!=200) throw Exception('HTTP ${response.statusCode}');
    final data=jsonDecode(response.body) as Map<String,dynamic>;
    for(final raw in (data['items'] as List)){final incoming=DiaryItem.fromMap(Map<String,Object?>.from(raw));final current=local.where((e)=>e.id==incoming.id).firstOrNull;if(current==null||incoming.updatedAt>current.updatedAt){await save(incoming);}}
  }
}
