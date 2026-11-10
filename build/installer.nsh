; Media Collection installer additions (electron-builder NSIS include).
; The application is installed per machine, so these run with administrator rights.

!macro customInstall
  ; Incoming connections from browsers and phones, on whatever HTTP and HTTPS ports are set, all
  ; protocols (the router discovery uses UDP), so Windows has no reason to ask:
  ; the rule is for the program (the backend runs in a process of the same executable).
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Media Collection"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Media Collection" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" profile=private,public enable=yes'
  ; Opens local maintenance when the application cannot start (named in its recovery steps).
  CreateShortCut "$SMPROGRAMS\Media Collection maintenance.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--maintenance" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!macro customUnInstall
  ; An update reinstalls straight after: the rule and the shortcut are added again.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Media Collection"'
  Delete "$SMPROGRAMS\Media Collection maintenance.lnk"
!macroend
