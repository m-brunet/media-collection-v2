; Media Collection installer additions (electron-builder NSIS include).
; The application is installed per machine, so these run with administrator rights.

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!macro customInstall
  ; Incoming connections from browsers and phones, on whatever HTTP and HTTPS ports are set, all
  ; protocols (the router discovery uses UDP), so Windows has no reason to ask:
  ; the rule is for the program (the backend runs in a process of the same executable).
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Media Collection"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Media Collection" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" profile=private,public enable=yes'
  ; Opens local maintenance when the application cannot start (named in its recovery steps).
  CreateShortCut "$SMPROGRAMS\Media Collection maintenance.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--maintenance" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!ifdef BUILD_UNINSTALLER
  ; The application data (library, accounts, settings, certificates) stays by default, ready for a
  ; later installation. Backups in Documents are never deleted here: only by hand.
  Var mcDeleteDataBox
  Var mcDeleteData

  !macro customUnWelcomePage
    !insertmacro MUI_UNPAGE_WELCOME
    UninstPage custom un.mcDataPageCreate un.mcDataPageLeave
  !macroend

  Function un.mcDataPageCreate
    StrCpy $mcDeleteData ${BST_UNCHECKED}
    ${if} $LANGUAGE == 1036
      !insertmacro MUI_HEADER_TEXT "Données de Media Collection" "Choisissez de garder ou de supprimer vos données."
      StrCpy $R1 "Par défaut, vos données restent sur cet ordinateur : la bibliothèque, les couvertures, les comptes et les réglages. Une prochaine installation de Media Collection les retrouve."
      StrCpy $R2 "Supprimer aussi mes données Media Collection"
      StrCpy $R3 "Attention : la bibliothèque, les couvertures, les comptes, les réglages et les certificats sont supprimés définitivement. Une prochaine installation repart de zéro. Les sauvegardes du dossier Documents\Media Collection backups sont gardées ; supprimez-les vous-même si besoin."
    ${else}
      !insertmacro MUI_HEADER_TEXT "Media Collection data" "Choose whether to keep or delete your data."
      StrCpy $R1 "By default your data stays on this computer: the library, covers, accounts and settings. A later installation of Media Collection finds them again."
      StrCpy $R2 "Also delete my Media Collection data"
      StrCpy $R3 "Warning: the library, covers, accounts, settings and certificates are deleted for good. A later installation starts from nothing. The backups in Documents\Media Collection backups are kept; delete them yourself if needed."
    ${endif}

    nsDialogs::Create 1018
    Pop $0
    ${if} $0 == error
      Abort
    ${endif}

    ${NSD_CreateLabel} 0 0 100% 36u "$R1"
    Pop $0
    ${NSD_CreateCheckbox} 0 44u 100% 12u "$R2"
    Pop $mcDeleteDataBox
    ${NSD_CreateLabel} 0 64u 100% 60u "$R3"
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function un.mcDataPageLeave
    ${NSD_GetState} $mcDeleteDataBox $mcDeleteData
  FunctionEnd
!endif

!macro customUnInstall
  ; An update reinstalls straight after: the rule and the shortcut are added again.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Media Collection"'
  Delete "$SMPROGRAMS\Media Collection maintenance.lnk"

  ; Only when the person ticked the box, never during an update. The data lives in the person's
  ; own application data folder (Electron's userData), not in the per-machine folders.
  ${ifNot} ${isUpdated}
    ${if} $mcDeleteData == ${BST_CHECKED}
      SetShellVarContext current
      RMDir /r "$APPDATA\Media Collection"
      SetShellVarContext all
    ${endif}
  ${endif}
!macroend
