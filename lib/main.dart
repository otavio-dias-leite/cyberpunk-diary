import 'package:flutter/material.dart';
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
  String view = 'Mês';
  int tab = 0;
  List<DiaryItem> items = [];
  bool loading = true;
  @override void initState(){super.initState(); _refresh();}
  Future<void> _refresh() async { final data=await DiaryDb.instance.all(); if(mounted)setState(() { items=data; loading=false; }); }
  List<DiaryItem> get visible => items.where((e)=>e.deletedAt==null).toList();
  Future<void> _create(String kind,{DateTime? date}) async {
    final title=TextEditingController(), body=TextEditingController();
    bool checklist=false;
    final ok=await showDialog<bool>(context:context,builder:(ctx)=>StatefulBuilder(builder:(ctx,change)=>AlertDialog(
      title:Text(kind=='note'?'Nova nota':kind=='list'?'Nova lista':'Nova tarefa'),
      content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
        TextField(controller:title,autofocus:true,decoration:const InputDecoration(labelText:'Título')),
        const SizedBox(height:10), TextField(controller:body,minLines:3,maxLines:7,decoration:InputDecoration(labelText:kind=='note'?'Conteúdo / Markdown':kind=='list'?'Itens (um por linha)':'Detalhes')),
        if(kind=='list') CheckboxListTile(value:checklist,title:const Text('Lista de tarefas'),onChanged:(v)=>change(()=>checklist=v??false)),
      ])),
      actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancelar')),FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Salvar'))],
    )));
    if(ok==true && title.text.trim().isNotEmpty){
      final now=DateTime.now().toUtc().millisecondsSinceEpoch;
      await DiaryDb.instance.save(DiaryItem(id:const Uuid().v4(),kind:kind,title:title.text.trim(),body:body.text,dueAt:date?.millisecondsSinceEpoch,done:false,updatedAt:now,deletedAt:null));
      await _refresh();
    }
  }
  Future<void> _edit(DiaryItem item) async {
    final title=TextEditingController(text:item.title), body=TextEditingController(text:item.body);
    final ok=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(title:Text(item.kind=='note'?'Editar nota':'Editar tarefa'),content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[TextField(controller:title,decoration:const InputDecoration(labelText:'Título')),const SizedBox(height:10),TextField(controller:body,minLines:3,maxLines:8,decoration:const InputDecoration(labelText:'Conteúdo'))])),actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancelar')),FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Salvar'))]));
    if(ok==true && title.text.trim().isNotEmpty){await DiaryDb.instance.save(item.copy(title:title.text.trim(),body:body.text,updatedAt:DateTime.now().toUtc().millisecondsSinceEpoch));await _refresh();}
  }
  Future<void> _done(DiaryItem e,bool value) async {await DiaryDb.instance.save(e.copy(done:value,updatedAt:DateTime.now().toUtc().millisecondsSinceEpoch));await _refresh();}
  Future<void> _delete(DiaryItem e) async {await DiaryDb.instance.save(e.copy(deletedAt:DateTime.now().toUtc().millisecondsSinceEpoch,updatedAt:DateTime.now().toUtc().millisecondsSinceEpoch));await _refresh();}
  @override Widget build(BuildContext context){
    final accent=Theme.of(context).colorScheme.primary;
    final dayItems=visible.where((e)=>e.dueAt!=null && DateUtils.isSameDay(DateTime.fromMillisecondsSinceEpoch(e.dueAt!),focus)).toList();
    final undated=visible.where((e)=>e.dueAt==null).toList();
    return Scaffold(appBar:AppBar(title:const Text('CYBERPUNK DIARY',style:TextStyle(fontWeight:FontWeight.w900,letterSpacing:1.4,fontSize:17)),actions:[IconButton(tooltip:'Sincronização',onPressed:()=>_syncDialog(),icon:const Icon(Icons.sync)),PopupMenuButton<String>(icon:const Icon(Icons.palette_outlined),onSelected:_setTheme,itemBuilder:(_)=>themes.keys.map((e)=>PopupMenuItem(value:e,child:Text(e))).toList())]),
      floatingActionButton:FloatingActionButton.extended(onPressed:_showCreateMenu,icon:const Icon(Icons.add),label:const Text('NOVO')),
      body:loading?const Center(child:CircularProgressIndicator()):Column(children:[
        Padding(padding:const EdgeInsets.fromLTRB(12,8,12,4),child:Row(children:[
          IconButton(onPressed:()=>setState(()=>focus=DateTime(focus.year,focus.month-1,focus.day)),icon:const Icon(Icons.chevron_left)),
          Expanded(child:Center(child:Text(view=='Dia'?DateFormat('dd MMM yyyy','pt_BR').format(focus):DateFormat('MMMM yyyy','pt_BR').format(focus).toUpperCase(),style:const TextStyle(fontWeight:FontWeight.bold)))),
          IconButton(onPressed:()=>setState(()=>focus=DateTime(focus.year,focus.month+1,focus.day)),icon:const Icon(Icons.chevron_right)),
          IconButton(onPressed:()=>setState(()=>focus=DateTime.now()),icon:const Icon(Icons.today)),
        ])),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: ['Semana', 'Mês', 'Dia', 'Sem data'].map((option) {
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: ChoiceChip(
                    label: Center(child: Text(option, style: const TextStyle(fontSize: 10))),
                    selected: view == option,
                    onSelected: (_) => setState(() => view = option),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        if(view=='Mês') _monthGrid(accent),
        if(view=='Semana') _weekStrip(accent),
        if(view=='Dia') Padding(padding:const EdgeInsets.all(10),child:Text(DateFormat('EEEE, dd MMMM','pt_BR').format(focus).toUpperCase())),
        Expanded(child: tab==1?_itemList(visible.where((e)=>e.kind=='note').toList()):tab==2?_itemList(visible.where((e)=>e.kind!='note').toList()):view=='Sem data'?_itemList(undated):_itemList(dayItems)),
      ]),
      bottomNavigationBar:NavigationBar(selectedIndex:tab,onDestinationSelected:(i)=>setState(()=>tab=i),destinations:const [NavigationDestination(icon:Icon(Icons.calendar_month),label:'Agenda'),NavigationDestination(icon:Icon(Icons.sticky_note_2_outlined),label:'Notas'),NavigationDestination(icon:Icon(Icons.checklist),label:'Tarefas')]),
    );
  }
  Widget _monthGrid(Color accent){
    final first=DateTime(focus.year,focus.month,1); final start=first.subtract(Duration(days:first.weekday%7));
    return Padding(padding:const EdgeInsets.symmetric(horizontal:10),child:Column(children:[
      Row(children:['D','S','T','Q','Q','S','S'].map((d)=>Expanded(child:Center(child:Text(d,style:const TextStyle(fontSize:10,color:Colors.white54))))).toList()),
      for (int week = 0; week < 6; week++)
        Row(
          children: List.generate(7, (dayIndex) {
            final date = start.add(Duration(days: week * 7 + dayIndex));
            final selected = DateUtils.isSameDay(date, focus);
            final count = visible.where((item) =>
              item.dueAt != null &&
              DateUtils.isSameDay(DateTime.fromMillisecondsSinceEpoch(item.dueAt!), date)
            ).length;
            return Expanded(
              child: InkWell(
                onTap: () => setState(() => focus = date),
                child: Container(
                  height: 35,
                  margin: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: selected ? accent.withValues(alpha: .18) : null,
                    border: selected ? Border.all(color: accent) : null,
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('${date.day}', style: TextStyle(
                        fontSize: 11,
                        color: date.month == focus.month ? Colors.white : Colors.white30,
                      )),
                      if (count > 0)
                        Container(width: 4, height: 4, decoration: BoxDecoration(
                          color: accent, shape: BoxShape.circle,
                        )),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
    ]));
  }
  Widget _weekStrip(Color accent) {
    final start = focus.subtract(Duration(days: focus.weekday % 7));
    return SizedBox(
      height: 66,
      child: Row(
        children: List.generate(7, (index) {
          final date = start.add(Duration(days: index));
          final selected = DateUtils.isSameDay(date, focus);
          return Expanded(
            child: InkWell(
              onTap: () => setState(() => focus = date),
              child: Container(
                margin: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: selected ? accent.withValues(alpha: .18) : null,
                  borderRadius: BorderRadius.circular(9),
                  border: selected ? Border.all(color: accent) : null,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(DateFormat('E', 'pt_BR').format(date).toUpperCase(),
                      style: const TextStyle(fontSize: 9)),
                    Text('${date.day}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
  Widget _itemList(List<DiaryItem> list)=>list.isEmpty?const Center(child:Text('Nenhum registro',style:TextStyle(color:Colors.white38))):ListView.builder(padding:const EdgeInsets.fromLTRB(12,8,12,90),itemCount:list.length,itemBuilder:(ctx,i){final e=list[i];return Card(child:ListTile(leading:e.kind=='note'?const Icon(Icons.notes):Checkbox(value:e.done,onChanged:(v)=>_done(e,v??false)),title:Text(e.title,style:TextStyle(decoration:e.done?TextDecoration.lineThrough:null)),subtitle:e.body.isEmpty?null:Text(e.body,maxLines:2,overflow:TextOverflow.ellipsis),onTap:()=>_edit(e),trailing:IconButton(icon:const Icon(Icons.delete_outline),onPressed:()=>_delete(e))));});
  Future<void> _showCreateMenu() async { final choice=await showModalBottomSheet<String>(context:context,builder:(ctx)=>SafeArea(child:Wrap(children:[for(final entry in <String,String>{'task':'Tarefa','note':'Nota','list':'Lista de tarefas'}.entries) ListTile(leading:Icon(entry.key=='note'?Icons.notes:entry.key=='list'?Icons.checklist:Icons.task_alt),title:Text(entry.value),onTap:()=>Navigator.pop(ctx,entry.key))]))); if(choice!=null) _create(choice,date:choice=='task'&&tab==0&&view!='Sem data'?focus:null); }
  Future<void> _setTheme(String value) async {themeName.value=value;final p=await SharedPreferences.getInstance();await p.setString('theme',value);}
  Future<void> _syncDialog() async {final url=TextEditingController(),token=TextEditingController();final p=await SharedPreferences.getInstance();url.text=p.getString('sync_url')??'';token.text=p.getString('sync_token')??'';final ok=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(title:const Text('SYNC DEVICE'),content:Column(mainAxisSize:MainAxisSize.min,children:[TextField(controller:url,decoration:const InputDecoration(labelText:'Host URL')),TextField(controller:token,obscureText:true,decoration:const InputDecoration(labelText:'Token'))]),actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Fechar')),FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Sincronizar'))]));if(ok==true){await p.setString('sync_url',url.text.trim());await p.setString('sync_token',token.text);try{await SyncService(url.text.trim(),token.text).sync(await DiaryDb.instance.all(),DiaryDb.instance.save);if(mounted){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Sincronização concluída')));_refresh();}}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Falha na sincronização: $e')));}}}
}
