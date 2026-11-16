#define MyAppName "Cyberpunk Diary"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Otavio Dias Leite"
#define MyAppExeName "cyberpunk_diary.exe"

[Setup]
AppId={{A7B3F1C2-9D64-4E18-8B7A-1F2C3D4E5A60}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Cyberpunk Diary
DefaultGroupName={#MyAppName}
OutputDir=.
OutputBaseFilename=CyberpunkDiary-Setup-1.0.0
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\{#MyAppExeName}

[Files]
Source: "build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\Cyberpunk Diary"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Cyberpunk Diary"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos adicionais:"
