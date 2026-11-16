import 'package:flutter_test/flutter_test.dart';
import 'package:cyberpunk_diary/main.dart';

void main() {
  test('all four themes are registered', () {
    expect(themes.keys, containsAll(['Cyberpunk Red', 'Cyberpunk', 'Matrix', 'Soul Killer']));
    expect(themes.values.toSet(), hasLength(4));
  });

  test('theme builder applies the selected accent', () {
    for (final entry in themes.entries) {
      expect(buildTheme(entry.key).colorScheme.primary, entry.value);
    }
  });
}
