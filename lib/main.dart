import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'data.dart';
import 'sync.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR');
  await DiaryDb.instance.init();
  runApp(const CyberpunkDiary());
}

const themes = <String, Color>{
  'Cyberpunk Red': Color(0xFFFF2941),
  'Cyberpunk': Color(0xFF00E5FF),
  'Matrix': Color(0xFF39FF14),
  'Soul Killer': Color(0xFFFFC400),
};
final themeName = ValueNotifier<String>('Cyberpunk Red');

ThemeData buildTheme(String name) {
  final accent = themes[name] ?? themes.values.first;
  final bg = name == 'Soul Killer' ? const Color(0xFF080808) : const Color(0xFF090A0E);
  return ThemeData(
    brightness: Brightness.dark, scaffoldBackgroundColor: bg,
    colorScheme: ColorScheme.dark(primary: accent, secondary: accent, surface: const Color(0xFF15171D)),
    textTheme: GoogleFonts.orbitronTextTheme(ThemeData.dark().textTheme), fontFamily: GoogleFonts.orbitron().fontFamily, useMaterial3: true,
    appBarTheme: const AppBarTheme(backgroundColor: Color(0xFF0D0E13), elevation: 0),
    cardTheme: CardThemeData(color: const Color(0xFF14161D), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: accent.withValues(alpha: .22)))),
    inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: const Color(0xFF171920), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
  );
}

class CyberpunkDiary extends StatefulWidget {
  const CyberpunkDiary({super.key});
  @override State<CyberpunkDiary> createState() => _CyberpunkDiaryState();
}
class _CyberpunkDiaryState extends State<CyberpunkDiary> {
  @override void initState() { super.initState(); _loadTheme(); }
  Future<void> _loadTheme() async {
    final p = await SharedPreferences.getInstance();
    themeName.value = p.getString('theme') ?? 'Cyberpunk Red';
  }
  @override Widget build(BuildContext context) => ValueListenableBuilder<String>(
    valueListenable: themeName,
    builder: (_, name, __) => MaterialApp(
      debugShowCheckedModeBanner: false, title: 'Cyberpunk Diary',
      theme: buildTheme(name), home: const DiaryHome(),
    ),
  );
}

class DiaryHome extends StatefulWidget { const DiaryHome({super.key}); @override State<DiaryHome> createState()=>_DiaryHomeState(); }
class _DiaryHomeState extends State<DiaryHome> {
  DateTime focus = DateTime.now();
  String view = 'Atual';
  int tab = 0;
  List<DiaryItem> items = [];
  bool loading = true;
  @override void initState(){super.initState(); _refresh();}
  Future<void> _refresh() async { final data=await DiaryDb.instance.all(); if(mounted)setState(() { items=data; loading=false; }); }
  List<DiaryItem> get visible => items.where((e)=>e.deletedAt==null).toList();
  Future<void> _create(String kind,{DateTime? date}) async {
    final title=TextEditingController(), body=TextEditingController();
    DateTime? dueDate=date;
    final ok=await showDialog<bool>(context:context,builder:(ctx)=>StatefulBuilder(builder:(ctx,change)=>AlertDialog(
      title:Text(kind=='note'?'Nova nota':kind=='list'?'Nova lista':'Nova tarefa'),
      content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
        TextField(controller:title,autofocus:true,decoration:const InputDecoration(labelText:'Título')),
        const SizedBox(height:10), TextField(controller:body,minLines:3,maxLines:7,decoration:InputDecoration(labelText:kind=='note'?'Conteúdo / Markdown':kind=='list'?'Itens (um por linha)':'Detalhes')),
        if(kind!='note') Row(children:[Expanded(child:Text(dueDate==null?'Sem data':DateFormat('dd/MM/yyyy').format(dueDate!))),TextButton(onPressed:() async {final picked=await showDatePicker(context:ctx,initialDate:dueDate??focus,firstDate:DateTime(2000),lastDate:DateTime(2100));if(picked!=null)change(()=>dueDate=picked);},child:const Text('DEFINIR DATA')),if(dueDate!=null)IconButton(onPressed:()=>change(()=>dueDate=null),icon:const Icon(Icons.close))]),
      ])),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancelar')),FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Salvar'))],
    )));
    if(ok==true && title.text.trim().isNotEmpty){
      final now=DateTime.now().toUtc().millisecondsSinceEpoch;
      await DiaryDb.instance.save(DiaryItem(id:const Uuid().v4(),kind:kind,title:title.text.trim(),body:kind=='list'?jsonEncode(body.text.split('\\n').map((line)=>line.trim()).where((line)=>line.isNotEmpty).map((line)=>{'text':line,'done':false}).toList()):body.text,dueAt:dueDate?.millisecondsSinceEpoch,done:false,updatedAt:now,deletedAt:null));
      await _refresh();
    }
  }
  Future<void> _edit(DiaryItem item) async {
    final title = TextEditingController(text: item.title);
    final originalEntries = item.kind == 'list' ? _decodeList(item.body) : <Map<String, dynamic>>[];
    final body = TextEditingController(
      text: item.kind == 'list'
          ? originalEntries.map((entry) => entry['text'].toString()).join('\n')
          : item.body,
    );
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item.kind == 'note' ? 'Editar nota' : item.kind == 'list' ? 'Editar lista' : 'Editar tarefa'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: title, decoration: const InputDecoration(labelText: 'Título')),
              const SizedBox(height: 10),
              TextField(
                controller: body,
                minLines: 3,
                maxLines: 8,
                decoration: InputDecoration(
                  labelText: item.kind == 'note' ? 'Markdown' : item.kind == 'list' ? 'Itens (um por linha)' : 'Detalhes',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Salvar')),
        ],
      ),
    );
    if (ok == true && title.text.trim().isNotEmpty) {
      String updatedBody = body.text;
      if (item.kind == 'list') {
        final oldStates = <String, bool>{
          for (final entry in originalEntries)
            entry['text'].toString(): entry['done'] == true,
        };
        updatedBody = jsonEncode(
          body.text
              .split('\n')
              .map((line) => line.trim())
              .where((line) => line.isNotEmpty)
              .map((line) => <String, dynamic>{
                    'text': line,
                    'done': oldStates[line] ?? false,
                  })
              .toList(),
        );
      }
      await DiaryDb.instance.save(item.copy(
        title: title.text.trim(),
        body: updatedBody,
        updatedAt: DateTime.now().toUtc().millisecondsSinceEpoch,
      ));
      await _refresh();
    }
  }

  
