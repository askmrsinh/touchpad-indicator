��    R      �  m   <      �     �     �       �         �       $     &   6     ]     d     }     �     �  	   �  	   �  /   �  '   �     	     	     *	     =	     C	     R	     Z	  �   p	  W   
  �   d
     	          9  '   H     p     �     �     �     �  "   �     �       4     %   ;     a     y  Y   �  "   �          '     5  	   E     O  C   [  �   �  n   D  �  �     �     �     �     �     �       
        $     =  A   \  C   �     �     �       V   !      x     �     �     �  ;   �  O  �      <     ]     }     �     �     �  L  �       1        H  �   M  %   7     ]     o      �     �  !   �     �     �     �     	       G   %  6   m     �     �  .   �     �     �            �   &  b   �  �   B          (     @  W   P     �     �     �     �        (        C     F  I   L  *   �  $   �     �  P   �  &   H  0   o     �     �  	   �     �  ]   �  �   N  �   �  @  ~     �!     �!      �!     �!  
   "     "  
   ("     3"     O"  7   m"  9   �"  $   �"  %   #  	   *#  r   4#  +   �#     �#     �#     �#  F   �#  �  1$  !   �%     �%     �%     &     &     4&         P   "   2   G              C   .   	       A   <      L       !   F   ,         ;   :               (          '      B   7   9      #   >      J      %       8            K   @           
   -   4      =         *   Q   1                 3       ?       I                /       O   H              6   5          M       &             )       $                    N   D      E   R       +   0              - No mouse device detected. About All debug logs are additionally written to the file 'touchpad-indicator.log' in the extension directory.
Attention!
This feature will slow down the startup of gnome-shell and the usage of the extension. Attention - No Touchpad Detected Auto Switch Automatically switch Touchpad On/Off Automatically switch Trackpoint On/Off Cancel Choose possible touchpad Confirm Dialog Debug Debug Informations Debug Log Debug log Define the behaviour if a mouse is (un)plugged. Exclude mouse device from autodetection Finger touch Fingertouch First time startup Gconf Gconf Settings General Gnome Shell Version:  Here you can choose some mouse devices to be excluded from autodetection, like your IR Remote Control or something similar.
All chosen devices are ignored. Here you find some information about your system which might be helpful in debugging.

 If you install 'xinput' on your pc, the extension could try to switch an undetected touchpad.
Please install 'xinput' and reload gnome-shell to enable this feature. Indicator Preferences Is installed and in use.
 Is installed.
 Method by which to switch the touchpad. Mouse plugged in -  Mouse unplugged -  No Touchpad detected. No Xinput installed Not found on your system.
 Not found or used on your system.
 OK Pen Set switching method and indicator icon preferences. Settings for debugging the extension. Show Icon in Main Panel Show notification Show notifications if the touchpad or the trackpoint is automatically switched on or off. Show or hide the icon in the panel Sorry could not read logfile!
 Switch Method Switch Method:  Synclient Synclient:  The debug log since last restart, if debugging to file was enabled. The extension could not detect a touchpad at the moment.
Perhaps your touchpad is not detected correctly by the kernel.
The following devices are detected as mice:
 The extension could not detect a touchpad at the moment.
You'll find further information in the Debug section. These settings allow you to customize this extension to your needs. You can open this dialog again by clicking on the extension's icon and selecting Indicator Preferences.

Please feel free to contact me if you find bugs or have suggestions, criticisms, or feedback. I am always happy to receive feedback - whatever kind. :-) 

Contact me on github (https://github.com/orangeshirt/gnome-shell-extension-touchpad-indicator) or on my bug tracker (https://extensions.gnome.org/extension/131/touchpad-indicator/). Touchpad Touchpad Indicator Touchpad Indicator Version:  Touchpad Preferences Touchpad(s):  Touchscreen Trackpoint Try to find the touchpad Turns the debug log on or off. Turns touchpad automatically on or off if a mouse is (un)plugged. Turns trackpoint automatically on or off if a mouse is (un)plugged. View debug information. Warning - No Touchpad Detected Welcome Would you really disable this device?
There seems to be no other mouse device enabled! Write debug information to file. XInput Xinput Xinput:  You can choose the mouse entry which could be the touchpad. You could try to find a possible touchpad.
Below you could choose the possible touchpad from the list of the detected mice. In most cases you should choose the entry 'PS/2 Generic Mouse' if available.
The switch method will be automatically switched to Xinput, because only with Xinput it is possible to switch an undetected touchpad.
 touchpad and trackpoint disabled touchpad and trackpoint enabled touchpad disabled touchpad enabled trackpoint disabled trackpoint enabled Project-Id-Version: 
Report-Msgid-Bugs-To: 
PO-Revision-Date: 2018-07-16 16:44+0200
Language-Team: 
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit
X-Generator: Poedit 2.0.6
Last-Translator: Jimmy Scionti <jimmy.scionti@gmail.com>
Plural-Forms: nplurals=2; plural=(n != 1);
Language: it_IT
       - Nessun dispositivo di puntamento rilevato.. Info Tutti i log di debug sono automaticamente scritti all'interno del file 'touchpad-indicator.log' posto nella directory dell'estensione.
Attenzione!
Questa caratteristica rallenterà l'avvio di gnome-shell e l'utilizzo dell'estensione. Attenzione - Nessun touchpad rilevato On/off automatico On/off automatico del touchpad On/off automatico del trackpoint Annulla Selezionare un possibile touchpad Dialogo di conferma Debug Informazioni di Debug Log del Debug Log del debug Specifica cosa avviene se una periferica di puntamento è (s)collegata. Escludi periferiche di puntamento dall'autorilevamento Finger Touch Fingertouch Mostra la schermata di benvenuto ad ogni avvio Gconf Impostazioni  Gconf Generale Versione Gnome Shell:  Qui è possibile selezione alcune periferiche di puntamento da escludere, dall'autorilevamento (ad esempio un gestore di presentazioni).
Tutte le periferiche selezionate sono ignorate. Qui è possibile trovare informazioni riguardo il sistema che potrebbero essere utili
nel debug.

 Con l'installazione di 'xinput', l'estensione potrebbe provare a pilotare automaticamente un
touchpad non rilevato.
Per favore installare 'xinput' e riavviare GNOME shell per abilitare questa caratteristica. Preferenze Indicatore Installato e in uso.\n
 È installato.
 Modalità attraverso la quale avviene l'accensione/spegnimento automatica del touchpad. Mouse collegato - 	 Mouse scollegato -  Nessun Touchpad rilevato. XInput non installato Non trovato nel sistema.
 Non trovato o utilizzato nel sistema.\n
 OK Penna Imposta il metodo di spegnimento/accensione e le preferenze per le icone. Impostazioni per il debug dell'estensione. Mostra icona nel pannello principale Mostra notifiche Notifica se il touchpad o il trackpoint vengono automaticamente accesi o spenti. Mostra o nasconde l'icona sul pannello Mi spiace, non riesco a leggere il file di log!
 Metodi di on/off automatico Metodi di on/off automatico:  Synclient Synclient:  Se il debug è stato attivato qui sotto ne è riportato il log a partire dall'ultimo riavvio. Questa estensione potrebbe non rilevare un touchpad al momento.
Forse il touchpad non è rilevato correttamente dal kernel.
Le seguenti periferiche sono rilevate come mouse:
 Questa estensione non può rilevare alcun touchpad al momento.
Ulteriori informazioni sono rintracciabili nella sezione 'Debug'. Queste impostazioni consentono di personalizzare questa estensione secondo i propri bisogni. È possibile 
accedere nuovamente a questa finestra cliccando sull'icona dell'estensione e selezionando 
'Impostazioni indicatore'.\n
\n
Ritieniti libero di contattarmi se trovi un bug o hai suggerimenti, 
critiche o feedback. Sono sempre felice di ricevere feedback - di qualunque 
tipo. :-) \n
\n
Contattami su github (https://github.com/orangeshirt/gnome-shell-extension-
touchpad-indicator) o sul mio bug tracker (https://extensions.gnome.org/
extension/131/touchpad-indicator/). Touchpad Indicatore Touchpad Versione di Touchpad Indicator:  Preferenze Touchpad Touchpad:  Touchscreen Trackpoint Prova a trovare un touchpad (Dis)attiva il log del debug. Accende/spegne il touchpad se un mouse è (s)collegato. Accende/spegne il trackpoint se un mouse è (s)collegato. Visualizza le informazioni di debug. Attenzione - Nessun touchpad rilevato Benvenuto Vuoi davvero disabilitare questo dispositivo?
Sembra che non ci sia nessun altro dispositivo di puntamento attivo! Scrive le informazione di debug in un file. XInput XInput Xinput:  È possibile selezionare la voce il quale dovrebbe essere il touchpad. È possibile provare a trovare un touchpad.
Di seguito è potrebbe essere scelto un possibile touchpad dalla lista dei mouse
rilevati. Nella maggior parte dei casi si dovrebbe scegliere la voce 'PS/2 Generic Mouse' se
disponibile.
Il metodo di on/off automatico sarà automaticamente impostato su Xinput, perchè solo
con Xinput è possibile accendere/spegnere un touchpad non rilevato.
 touchpad e trackpoint disattivati touchpad e trackpoint attivati touchpad disattivato touchpad attivato trackpoint disattivato trackpoint attivato 