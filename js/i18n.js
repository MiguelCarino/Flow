// Flow's own words, in five languages.
//
// This is the language of Flow: its buttons, menus and messages. It is not
// the language of the workflow that is open, which js/lang.js looks after
// and which only changes what the drawn screens say. The two never touch.
//
// English strings are the keys, so a string with no entry falls back to
// correct English, not to a symbol. Which language: ?lang= in the address,
// then the fleet's choice (carino-lang.js: the navbar's Language tab), then
// the browser's, then English.
//
// The words are in two places. WORDS, below, is what a client sees (the
// Simple view and Play) and the page's fixed chrome, a row per string. The
// editor's own panels, the findings and the report are in one file per
// language (js/words-es.js and the others), which add to FLOW_MORE.
// tests/suites/i18n.js fails if a language lacks a word that is asked for.
//
// Loaded early (after state.js), without defer: the scripts after it call
// t() as they run.

(function () {
'use strict';

const LOCALES = ['en', 'es', 'pt-BR', 'ja', 'ru'];
// English: [es, pt-BR, ja, ru]
const WORDS = {
    // ---- the Simple view and Play: translated in full ----
    'Simple view': ['Vista simple', 'Visão simples', 'かんたん表示', 'Простой вид'],
    'Full editor': ['Editor completo', 'Editor completo', '編集画面', 'Полный редактор'],
    'A view for reading the workflow and walking through it. Nothing here changes it.': ['Una vista para leer el flujo y recorrerlo. Aquí nada lo modifica.', 'Uma visão para ler o fluxo e percorrê-lo. Nada aqui o altera.', 'フローを読み、たどるための表示です。ここでは何も変更されません。', 'Вид для чтения сценария и прохода по нему. Здесь ничего не меняется.'],
    'Everything: drawing, checking, exporting.': ['Todo: dibujar, revisar, exportar.', 'Tudo: desenhar, verificar, exportar.', 'すべての機能：作図、チェック、書き出し。', 'Всё: рисование, проверки, экспорт.'],
    'Walk through it': ['Recorrerlo', 'Percorrer', '最初からたどる', 'Пройти по шагам'],
    'Untitled workflow': ['Flujo sin título', 'Fluxo sem título', '無題のフロー', 'Сценарий без названия'],
    '{n} screens': ['{n} pantallas', '{n} telas', '{n} 画面', 'Экранов: {n}'],
    '1 screen': ['1 pantalla', '1 tela', '1 画面', '1 экран'],
    'Tap a screen to open it, or walk through the workflow from the start.': ['Toca una pantalla para abrirla, o recorre el flujo desde el inicio.', 'Toque em uma tela para abri-la, ou percorra o fluxo desde o início.', '画面をタップして開くか、最初からフローをたどります。', 'Нажмите на экран, чтобы открыть его, или пройдите сценарий с начала.'],
    'There is nothing in this workflow yet.': ['Este flujo aún no tiene nada.', 'Este fluxo ainda não tem nada.', 'このフローにはまだ何もありません。', 'В этом сценарии пока ничего нет.'],
    'Workflow shown in': ['Flujo mostrado en', 'Fluxo exibido em', 'フローの表示言語', 'Язык сценария'],
    'The language of the interface you are drawing. It does not change the language of Flow itself.': ['El idioma de la interfaz que estás dibujando. No cambia el idioma de Flow.', 'O idioma da interface que você está desenhando. Não muda o idioma do Flow.', '作図している画面の言語です。Flow 自体の言語は変わりません。', 'Язык интерфейса, который вы рисуете. Язык самого Flow не меняется.'],
    '{code} (as written)': ['{code} (como se escribió)', '{code} (como foi escrito)', '{code}（原文）', '{code} (как написано)'],
    'From here': ['Desde aquí', 'A partir daqui', 'ここから', 'Отсюда'],
    'Which answer?': ['¿Qué respuesta?', 'Qual resposta?', 'どの答え？', 'Какой ответ?'],
    'The system decides': ['El sistema decide', 'O sistema decide', 'システムが判断', 'Решает система'],
    'The workflow ends here.': ['El flujo termina aquí.', 'O fluxo termina aqui.', 'フローはここで終わりです。', 'Сценарий заканчивается здесь.'],
    'Nothing leads on from here.': ['Nada continúa desde aquí.', 'Nada segue a partir daqui.', 'ここから先はありません。', 'Отсюда дальше ничего не ведёт.'],
    '← Back': ['← Atrás', '← Voltar', '← 戻る', '← Назад'],
    'Start again': ['Empezar de nuevo', 'Recomeçar', '最初から', 'Начать заново'],
    'Leave Play': ['Salir', 'Sair', '終了', 'Выйти'],
    'Go on': ['Continuar', 'Continuar', '進む', 'Далее'],
    'if {x}': ['si {x}', 'se {x}', '{x} の場合', 'если {x}'],
    'Leads several ways: choose one in the list': ['Lleva a varios lugares: elige uno en la lista', 'Leva a vários lugares: escolha um na lista', '行き先が複数あります。一覧から選んでください', 'Ведёт в несколько мест: выберите в списке'],
    'Where you have been': ['Por dónde has pasado', 'Por onde você passou', 'これまでの経路', 'Пройденный путь'],
    'There is no screen to start from yet.': ['Todavía no hay una pantalla desde la que empezar.', 'Ainda não há uma tela para começar.', '開始する画面がまだありません。', 'Пока нет экрана, с которого можно начать.'],
    'start': ['inicio', 'início', '開始', 'начало'],
    'end': ['fin', 'fim', '終了', 'конец'],
    'not included': ['no incluida', 'não incluída', '含まれていません', 'не включён'],
    'Play': ['Reproducir', 'Reproduzir', '再生', 'Просмотр'],
    '▶ Play': ['▶ Reproducir', '▶ Reproduzir', '▶ 再生', '▶ Просмотр'],
    'Click through the workflow from the start': ['Recorre el flujo desde el inicio', 'Percorra o fluxo desde o início', '最初からフローをたどります', 'Пройти сценарий с начала'],
    'Zoom in': ['Acercar', 'Aproximar', '拡大', 'Приблизить'],
    'Zoom out': ['Alejar', 'Afastar', '縮小', 'Отдалить'],
    'Fit': ['Ajustar', 'Ajustar', '全体表示', 'Вписать'],
    'Nothing here yet': ['Aún no hay nada', 'Ainda não há nada', 'まだ何もありません', 'Пока ничего нет'],
    'This workflow was made by a newer Flow. It is open to read only.': ['Este flujo se hizo con un Flow más nuevo. Está abierto solo para lectura.', 'Este fluxo foi feito com um Flow mais novo. Está aberto somente para leitura.', 'このフローは新しい Flow で作られました。読み取り専用で開いています。', 'Этот сценарий создан в более новой версии Flow. Он открыт только для чтения.'],
    'A sealed link': ['Un enlace sellado', 'Um link selado', '暗号化されたリンク', 'Запечатанная ссылка'],
    'This link carries a workflow that only its passphrase opens. Whoever sent it has the passphrase.': ['Este enlace lleva un flujo que solo abre su frase de paso. Quien lo envió la tiene.', 'Este link carrega um fluxo que só a frase-senha abre. Quem o enviou tem a frase.', 'このリンクには、パスフレーズでのみ開けるフローが入っています。パスフレーズは送り主が知っています。', 'В этой ссылке сценарий, который открывается только кодовой фразой. Она есть у отправителя.'],
    'Passphrase': ['Frase de paso', 'Frase-senha', 'パスフレーズ', 'Кодовая фраза'],
    'Open it': ['Abrir', 'Abrir', '開く', 'Открыть'],
    'Not now': ['Ahora no', 'Agora não', '今はしない', 'Не сейчас'],
    'Opening…': ['Abriendo…', 'Abrindo…', '開いています…', 'Открываю…'],
    'That passphrase does not open this link, or the link was cut short.': ['Esa frase de paso no abre este enlace, o el enlace está incompleto.', 'Essa frase-senha não abre este link, ou o link está incompleto.', 'そのパスフレーズではこのリンクを開けません。リンクが途中で切れている可能性もあります。', 'Эта кодовая фраза не открывает ссылку, либо ссылка обрезана.'],

    // ---- the editor's chrome: translated; the rest of the editor is English ----
    '↶ Undo': ['↶ Deshacer', '↶ Desfazer', '↶ 元に戻す', '↶ Отменить'],
    '↷ Redo': ['↷ Rehacer', '↷ Refazer', '↷ やり直す', '↷ Повторить'],
    'Undo (Ctrl+Z)': ['Deshacer (Ctrl+Z)', 'Desfazer (Ctrl+Z)', '元に戻す (Ctrl+Z)', 'Отменить (Ctrl+Z)'],
    'Redo (Ctrl+Shift+Z)': ['Rehacer (Ctrl+Mayús+Z)', 'Refazer (Ctrl+Shift+Z)', 'やり直す (Ctrl+Shift+Z)', 'Повторить (Ctrl+Shift+Z)'],
    'Board': ['Tablero', 'Quadro', 'ボード', 'Доска'],
    'Flow': ['Flujo', 'Fluxo', 'フロー', 'Схема'],
    'Screens at their real size, where you put them': ['Las pantallas a tamaño real, donde las pusiste', 'As telas em tamanho real, onde você as colocou', '画面を実寸で、配置した場所に表示', 'Экраны в реальном размере, там, где вы их поставили'],
    'Every screen as a card, laid out from the links': ['Cada pantalla como una tarjeta, ordenadas según los enlaces', 'Cada tela como um cartão, organizadas pelos links', '各画面をカードにして、リンクに沿って並べます', 'Каждый экран — карточка, расставленные по связям'],
    'File': ['Archivo', 'Arquivo', 'ファイル', 'Файл'],
    'New workflow': ['Nuevo flujo', 'Novo fluxo', '新しいフロー', 'Новый сценарий'],
    'Open a file…': ['Abrir un archivo…', 'Abrir um arquivo…', 'ファイルを開く…', 'Открыть файл…'],
    'Save a copy': ['Guardar una copia', 'Salvar uma cópia', 'コピーを保存', 'Сохранить копию'],
    'Export…': ['Exportar…', 'Exportar…', '書き出し…', 'Экспорт…'],
    'pictures, report, link': ['imágenes, informe, enlace', 'imagens, relatório, link', '画像・レポート・リンク', 'картинки, отчёт, ссылка'],
    'Your workflows…': ['Tus flujos…', 'Seus fluxos…', '保存したフロー…', 'Ваши сценарии…'],
    'Your workflows': ['Tus flujos', 'Seus fluxos', '保存したフロー', 'Ваши сценарии'],
    'in this browser': ['en este navegador', 'neste navegador', 'このブラウザ内', 'в этом браузере'],
    'Merge a part back in…': ['Reincorporar una parte…', 'Reincorporar uma parte…', '一部を取り込んで統合…', 'Влить часть обратно…'],
    'Bring in a copy sheet…': ['Traer una hoja de textos…', 'Trazer uma planilha de textos…', '文言シートを取り込む…', 'Загрузить таблицу текстов…'],
    'Open the example': ['Abrir el ejemplo', 'Abrir o exemplo', 'サンプルを開く', 'Открыть пример'],
    'open the example': ['abre el ejemplo', 'abra o exemplo', 'サンプルを開く', 'откройте пример'],
    'Add a screen from the left, or': ['Añade una pantalla desde la izquierda, o', 'Adicione uma tela pela esquerda, ou', '左から画面を追加するか、', 'Добавьте экран слева или'],
    'Add': ['Añadir', 'Adicionar', '追加', 'Добавить'],
    '+ Screen': ['+ Pantalla', '+ Tela', '+ 画面', '+ Экран'],
    '+ Element': ['+ Elemento', '+ Elemento', '+ 要素', '+ Элемент'],
    '◇ Decision': ['◇ Decisión', '◇ Decisão', '◇ 判断', '◇ Решение'],
    '▣ Block': ['▣ Bloque', '▣ Bloco', '▣ ブロック', '▣ Блок'],
    'Starting from': ['A partir de', 'A partir de', 'テンプレート', 'На основе'],
    'Select a screen to add elements to it.': ['Selecciona una pantalla para añadirle elementos.', 'Selecione uma tela para adicionar elementos.', '画面を選ぶと要素を追加できます。', 'Выберите экран, чтобы добавить на него элементы.'],
    'Walk': ['Recorrido', 'Percurso', '経路', 'Маршрут'],
    'Test': ['Pruebas', 'Testes', 'テスト', 'Тесты'],
    'Findings': ['Hallazgos', 'Achados', '指摘', 'Замечания'],
    'Kept': ['Guardado', 'Guardado', '保存済み', 'Сохранён'],
    'Open the panel': ['Abrir el panel', 'Abrir o painel', 'パネルを開く', 'Открыть панель'],
    'Export': ['Exportar', 'Exportar', '書き出し', 'Экспорт'],
    'What': ['Qué', 'O quê', '対象', 'Что'],
    'As': ['Como', 'Como', '形式', 'Как'],
    'The whole workflow': ['Todo el flujo', 'O fluxo inteiro', 'フロー全体', 'Весь сценарий'],
    'The selected screens and decisions': ['Las pantallas y decisiones seleccionadas', 'As telas e decisões selecionadas', '選択した画面と判断', 'Выбранные экраны и решения'],
    'The way marked in Walk': ['El camino marcado en Recorrido', 'O caminho marcado em Percurso', '「経路」で選んだ道筋', 'Путь, отмеченный в «Маршруте»'],
    'The selected screen, every size of it': ['La pantalla seleccionada, en todos sus tamaños', 'A tela selecionada, em todos os tamanhos', '選択した画面（全サイズ）', 'Выбранный экран, все его размеры'],
    'A document that can be merged back (.flow.json)': ['Un documento que se puede reincorporar (.flow.json)', 'Um documento que pode ser reincorporado (.flow.json)', '後で統合できる文書 (.flow.json)', 'Документ, который можно влить обратно (.flow.json)'],
    'One picture of the workflow, as it is on show': ['Una imagen del flujo, tal como se muestra', 'Uma imagem do fluxo, como está exibido', 'フローの画像（表示中の状態）', 'Одна картинка сценария, как на экране'],
    'A picture of each screen': ['Una imagen de cada pantalla', 'Uma imagem de cada tela', '各画面の画像', 'Картинка каждого экрана'],
    'A storyboard of the marked way': ['Un guion gráfico del camino marcado', 'Um storyboard do caminho marcado', '選んだ道筋のストーリーボード', 'Раскадровка отмеченного пути'],
    'A report to read, send or print (.html)': ['Un informe para leer, enviar o imprimir (.html)', 'Um relatório para ler, enviar ou imprimir (.html)', '閲覧・送付・印刷用のレポート (.html)', 'Отчёт для чтения, отправки или печати (.html)'],
    'A copy sheet of every text (.csv)': ['Una hoja con todos los textos (.csv)', 'Uma planilha com todos os textos (.csv)', '全文言のシート (.csv)', 'Таблица всех текстов (.csv)'],
    'The test cases, whole workflow (.csv)': ['Los casos de prueba, todo el flujo (.csv)', 'Os casos de teste, fluxo inteiro (.csv)', 'テストケース（フロー全体）(.csv)', 'Тест-кейсы, весь сценарий (.csv)'],
    'Picture': ['Imagen', 'Imagem', '画像', 'Картинка'],
    'PNG, twice the size (sharp on any screen)': ['PNG, al doble de tamaño (nítida en cualquier pantalla)', 'PNG, com o dobro do tamanho (nítida em qualquer tela)', 'PNG・2倍（どの画面でも鮮明）', 'PNG, вдвое крупнее (чётко на любом экране)'],
    'PNG, actual size': ['PNG, tamaño real', 'PNG, tamanho real', 'PNG・等倍', 'PNG, реальный размер'],
    'PNG, three times the size': ['PNG, al triple de tamaño', 'PNG, com o triplo do tamanho', 'PNG・3倍', 'PNG, втрое крупнее'],
    'SVG (lines stay sharp at any size)': ['SVG (las líneas se ven nítidas a cualquier tamaño)', 'SVG (as linhas ficam nítidas em qualquer tamanho)', 'SVG（どの大きさでも線が鮮明）', 'SVG (линии чёткие в любом размере)'],
    'Passphrase, 8 characters or more': ['Frase de paso, 8 caracteres o más', 'Frase-senha, 8 caracteres ou mais', 'パスフレーズ（8文字以上）', 'Кодовая фраза, не меньше 8 символов'],
    'The workflow is encrypted here with this passphrase and put after the # of the link, which a browser never sends to a server. Whoever has both the link and the passphrase can open it.': ['El flujo se cifra aquí con esta frase de paso y se coloca después del # del enlace, que el navegador nunca envía a un servidor. Quien tenga el enlace y la frase puede abrirlo.', 'O fluxo é criptografado aqui com esta frase-senha e colocado depois do # do link, que o navegador nunca envia a um servidor. Quem tiver o link e a frase pode abri-lo.', 'フローはこのパスフレーズでここで暗号化され、リンクの # の後ろに入ります。この部分はブラウザからサーバーに送られません。リンクとパスフレーズの両方を持つ人が開けます。', 'Сценарий шифруется здесь этой кодовой фразой и помещается после # в ссылке — эту часть браузер никогда не отправляет на сервер. Открыть может тот, у кого есть и ссылка, и фраза.'],
    'Leave out where the real work is kept (the sources)': ['Omitir dónde se guarda el trabajo real (las fuentes)', 'Omitir onde o trabalho real é guardado (as fontes)', '実物の保管場所（ソース）を含めない', 'Не включать, где хранится настоящая работа (источники)'],
    'Open it in the Simple view': ['Abrirlo en la vista simple', 'Abrir na visão simples', 'かんたん表示で開く', 'Открывать в простом виде'],
    'Copy the link': ['Copiar el enlace', 'Copiar o link', 'リンクをコピー', 'Скопировать ссылку'],
    'Open to print': ['Abrir para imprimir', 'Abrir para imprimir', '印刷用に開く', 'Открыть для печати'],
    'Close': ['Cerrar', 'Fechar', '閉じる', 'Закрыть'],
    'Make the link': ['Crear el enlace', 'Criar o link', 'リンクを作成', 'Создать ссылку'],
    "Kept in this browser, on this computer. Nothing here is uploaded; clearing the browser's data removes them, so save a copy of what matters.": ['Guardados en este navegador, en este equipo. Nada se sube; al borrar los datos del navegador se eliminan, así que guarda una copia de lo importante.', 'Guardados neste navegador, neste computador. Nada é enviado; limpar os dados do navegador os remove, então salve uma cópia do que importa.', 'この PC のこのブラウザ内に保存されます。アップロードはされません。ブラウザのデータを消去すると失われるため、大切なものはコピーを保存してください。', 'Хранятся в этом браузере, на этом компьютере. Ничего не загружается; очистка данных браузера их удалит, поэтому сохраняйте копию важного.'],
    'The workflow that is open is kept, and saves itself on every change.': ['El flujo abierto está guardado y se guarda solo con cada cambio.', 'O fluxo aberto está guardado e se salva a cada alteração.', '開いているフローは保存済みで、変更のたびに自動保存されます。', 'Открытый сценарий сохранён и сохраняется сам при каждом изменении.'],
    'Keep the workflow that is open': ['Guardar el flujo abierto', 'Guardar o fluxo aberto', '開いているフローを保存', 'Сохранить открытый сценарий'],
    'This workflow is kept in this browser and saves itself on every change': ['Este flujo está guardado en este navegador y se guarda solo con cada cambio', 'Este fluxo está guardado neste navegador e se salva a cada alteração', 'このフローはこのブラウザに保存され、変更のたびに自動保存されます', 'Этот сценарий хранится в браузере и сохраняется сам при каждом изменении'],
    'Flow draws the workflow of a user interface: its screens at any size, the decisions between them and what takes the user from one to the next. It checks the workflow as you draw.': ['Flow dibuja el flujo de una interfaz: sus pantallas a cualquier tamaño, las decisiones entre ellas y lo que lleva al usuario de una a otra. Revisa el flujo mientras dibujas.', 'O Flow desenha o fluxo de uma interface: suas telas em qualquer tamanho, as decisões entre elas e o que leva o usuário de uma a outra. Ele verifica o fluxo enquanto você desenha.', 'Flow は画面のフローを描くツールです。あらゆるサイズの画面、その間の判断、画面から画面へ進むきっかけを描き、描くそばからチェックします。', 'Flow рисует сценарий интерфейса: экраны любого размера, решения между ними и то, что ведёт пользователя от одного к другому. Сценарий проверяется по мере рисования.'],
    'Runs in your browser. Nothing you add here is uploaded, and the addresses you save as sources are only links: Flow never opens them itself.': ['Funciona en tu navegador. Nada de lo que añadas se sube, y las direcciones que guardes como fuentes son solo enlaces: Flow nunca las abre por su cuenta.', 'Funciona no seu navegador. Nada do que você adicionar é enviado, e os endereços salvos como fontes são apenas links: o Flow nunca os abre sozinho.', 'ブラウザ内で動作します。追加した内容はアップロードされません。ソースとして保存したアドレスはリンクにすぎず、Flow が自分で開くことはありません。', 'Работает в браузере. Ничего из добавленного не загружается, а адреса источников — только ссылки: сам Flow их не открывает.'],
    'The file format is published:': ['El formato de archivo está publicado:', 'O formato de arquivo é público:', 'ファイル形式は公開されています：', 'Формат файла опубликован:'],
    'Circuit background': ['Fondo de circuito', 'Fundo de circuito', '基板の背景', 'Фон-плата'],
    'Drag an element onto a screen, or select a screen and click one.': ['Arrastra un elemento a una pantalla, o selecciona una pantalla y haz clic en uno.', 'Arraste um elemento para uma tela, ou selecione uma tela e clique em um.', '要素を画面にドラッグするか、画面を選んでから要素をクリックします。', 'Перетащите элемент на экран или выберите экран и нажмите на элемент.'],
    'Drop it on a screen or a block.': ['Suéltalo sobre una pantalla o un bloque.', 'Solte sobre uma tela ou um bloco.', '画面またはブロックの上にドロップしてください。', 'Отпустите над экраном или блоком.'],
    'Dark background': ['Fondo oscuro', 'Fundo escuro', '暗い背景', 'Тёмный фон'],
    'Blueprint background': ['Fondo de plano', 'Fundo de planta', '青写真の背景', 'Фон-чертёж'],
    'Light background': ['Fondo claro', 'Fundo claro', '明るい背景', 'Светлый фон'],
    'Elements': ['Elementos', 'Elementos', '要素', 'Элементы'],
    'Keep open': ['Mantener abierto', 'Manter aberto', '開いたままにする', 'Оставить открытым'],
    'Fold': ['Plegar', 'Recolher', 'たたむ', 'Свернуть'],
    'Show the elements and keep them open': ['Mostrar los elementos y mantenerlos abiertos', 'Mostrar os elementos e mantê-los abertos', '要素を表示して開いたままにする', 'Показать элементы и оставить открытыми'],
    'Fold the elements while something is selected': ['Plegar los elementos mientras haya algo seleccionado', 'Recolher os elementos enquanto algo estiver selecionado', '選択中は要素をたたむ', 'Сворачивать элементы, пока что-то выбрано'],
    'Screens': ['Pantallas', 'Telas', '画面', 'Экраны'],
    'Decisions': ['Decisiones', 'Decisões', '判断', 'Решения'],
    'Links': ['Enlaces', 'Links', 'リンク', 'Связи'],
    'Sources': ['Fuentes', 'Fontes', 'ソース', 'Источники'],
    'Languages': ['Idiomas', 'Idiomas', '言語', 'Языки']
};
// What the Simple view and Play say: every language must have every one.
const CLIENT_KEYS = Object.keys(WORDS).slice(0, Object.keys(WORDS).indexOf('↶ Undo'));

// The rest of the words, a file per language (js/words-*.js).
const MORE = window.FLOW_MORE = window.FLOW_MORE || {};
// What was asked for and had no translation, and everything t() has given
// out; the tests read the first, the walker below the second.
const missed = new Set(), given = new Set();

let locale = 'en';
function resolveLocale(tag) {
    const s = String(tag || '').toLowerCase();
    if (!s) return '';
    if (s.startsWith('pt')) return 'pt-BR';
    const two = s.slice(0, 2);
    return ['en', 'es', 'ja', 'ru'].includes(two) ? two : '';
}
// A string in the language on show. {name} in it is filled from params.
function t(key, params) {
    let s = lookup(key);
    // What t() gave out already comes back as it is: a message put together
    // with t() and then shown through say() is not looked up twice.
    if (s === undefined && given.has(key)) return key;
    if (s === undefined) { if (locale !== 'en' && /[A-Za-z]{2}/.test(String(key))) missed.add(String(key)); s = String(key); }
    if (params) Object.keys(params).forEach((k) => { s = s.split('{' + k + '}').join(String(params[k])); });
    given.add(s);
    if (given.size > 50000) given.clear();
    return s;
}
// -> the word in the language on show, or undefined when there is none.
// English has every word: the key itself.
function lookup(key) {
    if (locale === 'en') return key;
    const row = WORDS[key], i = LOCALES.indexOf(locale) - 1;
    if (row && row[i]) return row[i];
    const more = MORE[locale];
    return more && typeof more[key] === 'string' && more[key] ? more[key] : undefined;
}

// The panels the scripts draw are built in English and put through here:
// the words of Flow's own in them (labels, headings, notes, buttons, hints)
// are swapped for the language on show. What the workflow says (the names
// of its screens, its texts) is in other places and is never looked up.
const CHROME = '.pf-l, .pf-head, .pf-note, .pf-warn, .rail-title, .btn, .f-btn, .f-group, .size-on, summary, .pf-check > span, select[data-tr] > option, [data-tr]';
function translateChrome(root, selector) {
    if (!root) return;
    const swap = (text) => {
        const key = text.replace(/\s+/g, ' ').trim();
        if (!key || !/[A-Za-z]{2}/.test(key) || /^https?:\/\/\S*$/.test(key) || given.has(key)) return null;
        const s = lookup(key);
        if (s === undefined) { missed.add(key); return null; }
        given.add(s);
        return text.replace(text.trim(), s);
    };
    if (locale !== 'en') {
        root.querySelectorAll(selector || CHROME).forEach((el) => {
            if (el.hasAttribute('data-raw')) return;
            // Only an element that is all words: one with a name inside it is
            // put together with t() where it is made.
            if (el.children.length && !(el.tagName === 'BUTTON' || el.tagName === 'SUMMARY')) return;
            el.childNodes.forEach((n) => { if (n.nodeType === 3) { const s = swap(n.nodeValue); if (s !== null) n.nodeValue = s; } });
        });
        root.querySelectorAll('[title], [aria-label], [placeholder]').forEach((el) => ATTRS.forEach((a) => {
            const v = el.getAttribute(a);
            if (a === 'placeholder' && el.hasAttribute('data-raw-ph')) return;
            if (v && !el.hasAttribute('data-raw')) { const s = swap(v); if (s !== null) el.setAttribute(a, s); }
        }));
    }
}

// The page's fixed words: every text, title, label and hint outside the
// parts the scripts redraw. The English is remembered on first sight, so
// changing language twice still starts from it.
// carinoNav is the fleet's navbar, which has its own words; Flow's controls
// and its About text are moved inside it, and are walked on their own below.
const SKIP = ['board', 'railProps', 'railWalk', 'railTest', 'railFindings', 'playPane', 'testPane', 'libList', 'palette', 'libWrapRow', 'boardInkBtn', 'addTemplate', 'addPreset', 'flowLang', 'simpleBar', 'simpleBtn', 'carinoNav', 'TESTOUT'];
const ATTRS = ['title', 'aria-label', 'placeholder'];
const seen = new WeakMap();
// A word Flow has, in the main list or in a language's own file.
const known = (key) => !!WORDS[key] || LOCALES.some((l) => MORE[l] && typeof MORE[l][key] === 'string');
function applyStatic(root) {
    const walk = (node) => {
        if (node.nodeType === 3) {
            if (!seen.has(node)) { const raw = node.nodeValue, key = raw.replace(/\s+/g, ' ').trim(); seen.set(node, known(key) ? { raw, key } : null); }
            const en = seen.get(node);
            if (en) node.nodeValue = en.raw.replace(en.raw.trim(), t(en.key));
            return;
        }
        if (node.nodeType !== 1 || SKIP.includes(node.id) || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'svg') return;
        if (!seen.has(node)) { const had = {}; ATTRS.forEach((a) => { const v = node.getAttribute(a); if (v && known(v)) had[a] = v; }); seen.set(node, had); }
        const had = seen.get(node);
        Object.keys(had).forEach((a) => node.setAttribute(a, t(had[a])));
        node.childNodes.forEach(walk);
    };
    walk(root || document.body);
    if (!root) document.querySelectorAll('#carinoNav [data-carino-actions], #carinoNav [data-carino-about], #carinoNav [data-carino-howto]').forEach(walk);
}
function setLocale(code) {
    locale = LOCALES.includes(code) ? code : 'en';
    document.documentElement.lang = locale;
    if (document.body) applyStatic();
    // Everything the scripts draw is drawn again in the new language.
    if (typeof render === 'function' && typeof state !== 'undefined' && state.doc) render();
}
const fromAddress = () => { try { return resolveLocale(new URLSearchParams(location.search).get('lang')); } catch (e) { return ''; } };
const fromChoice = () => {
    try { const m = document.cookie.match(/(?:^|;\s*)carino_lang=([^;]+)/); if (m) return resolveLocale(decodeURIComponent(m[1])); } catch (e) { /* cookies blocked */ }
    try { return resolveLocale(localStorage.getItem('carino_lang')); } catch (e) { return ''; }
};
locale = fromAddress() || fromChoice() || resolveLocale(navigator.language) || 'en';
document.documentElement.lang = locale;
// The fleet's switch (the navbar's Language tab) says when the choice changes.
window.addEventListener('carino:langchange', (e) => setLocale(resolveLocale(e.detail && e.detail.lang) || 'en'));

// n things: the word for one, or the word for several with {n} filled in.
function tn(n, one, many) { return n === 1 ? t(one) : t(many, { n }); }
window.t = t;
// The same, under a name no function uses for something else (several keep
// a local t for a tally or a target).
window.tr = t;
window.tn = tn;
window.setLocale = setLocale;
window.applyStaticI18n = applyStatic;
window.flowLocale = () => locale;
window.translateChrome = translateChrome;
window.FLOW_I18N = { LOCALES, WORDS, CLIENT_KEYS, MORE, missed, given };
})();
