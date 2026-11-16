import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cyberpunk_diary/data.dart';
import 'package:cyberpunk_diary/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  test('all four themes build with distinct accents', () {
    for (final entry in themes.entries) {
      expect(buildTheme(entry.key).colorScheme.primary, entry.value);
    }
  });

  test('diary item survives map serialization', () {
    const item = DiaryItem(
      id: 'test-id', kind: 'task', title: 'Study', body: 'C programming',
      dueAt: 1735689600000, done: true, updatedAt: 1735600000000,
      deletedAt: null,
    );
    final restored = DiaryItem.fromMap(item.toMap());
    expect(restored.id, item.id);
    expect(restored.title, item.title);
    expect(restored.dueAt, item.dueAt);
    expect(restored.done, isTrue);
  });
  test('nullable fields can be explicitly cleared', () {
    const item = DiaryItem(
      id: 'clear-test', kind: 'task', title: 'Task', body: '',
      dueAt: 1735689600000, done: false, updatedAt: 10,
      deletedAt: 20,
    );
    final cleared = item.copy(dueAt: null, deletedAt: null);
    expect(cleared.dueAt, isNull);
    expect(cleared.deletedAt, isNull);
  });

}
