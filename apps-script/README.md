# CadastroSB no Google Apps Script

Versão do controle de cadastro de sobressalentes que usa uma **planilha Google
como banco de dados**. Várias pessoas acessam ao mesmo tempo, cada gravação vai
direto para a planilha e fica registrado quem alterou o quê.

## Por que essa versão

| | Arquivo HTML local | Google Apps Script |
| --- | --- | --- |
| Onde ficam os dados | Só no navegador de quem usa | Planilha Google, na nuvem |
| Vários usuários | Não — cada um tem os seus | Sim, todos veem o mesmo |
| Backup | Manual (exportar JSON) | Histórico de versões do Google |
| Acesso pelo celular | Precisa do arquivo no aparelho | Basta o link |
| Quem é cada colaborador | Escolhido por navegador | Segue a conta Google, em qualquer aparelho |

---

## Instalação

### 1. Crie a planilha

Crie uma planilha nova no Google Sheets e dê um nome
(ex.: *Cadastro de Sobressalentes*). Não precisa criar abas nem cabeçalhos —
o script faz isso sozinho.

### 2. Abra o editor de script

Na planilha: **Extensões › Apps Script**. Isso cria um script **vinculado** à
planilha, que é o modo recomendado — o código encontra a planilha sozinho.

### 3. Copie os quatro arquivos

No editor, crie os arquivos abaixo com o botão **+** ao lado de "Arquivos" e
cole o conteúdo correspondente desta pasta.

| Criar como | Nome no editor | Arquivo desta pasta | Tamanho |
| --- | --- | --- | --- |
| Script | `Codigo` | `Codigo.gs` | ~17 KB |
| HTML | `Index` | `Index.html` | ~9 KB |
| HTML | `Estilos` | `Estilos.html` | ~34 KB |
| HTML | `Script` | `Script.html` | ~45 KB |

> O editor acrescenta `.gs` e `.html` sozinho — digite só o nome.
> Os nomes precisam ser **exatamente** esses, porque `Index.html` chama
> `include('Estilos')` e `include('Script')`.

Apague o `function myFunction() {}` que vem no arquivo novo.

**Confira se colou inteiro.** O editor às vezes trunca textos longos. Depois de
colar cada arquivo, role até o fim e veja se o último caractere bate:
`Estilos.html` termina em `</style>` e `Script.html` termina em `</script>`.
Um CSS cortado no meio derruba o resto do arquivo e o app abre **sem
formatação** — é o sintoma clássico de colagem incompleta.

### 4. Prepare a planilha

No editor, com `Codigo.gs` aberto, escolha a função **`prepararPlanilha`** na
lista suspensa e clique em **Executar**. O Google vai pedir autorização:

1. **Revisar permissões** › escolha sua conta
2. Na tela "O Google não verificou este app": **Avançado** ›
   **Acessar CadastroSB (não seguro)** — esse aviso é normal para scripts
   próprios, que não passam pela revisão do Google
3. **Permitir**

Volte à planilha: a aba **Cadastros** foi criada, com cabeçalho e listas de
validação em Status e Especialidade.

### 5. Publique como aplicativo web

No editor: **Implantar › Nova implantação › (engrenagem) App da Web**.

| Campo | O que escolher |
| --- | --- |
| Descrição | `CadastroSB` |
| Executar como | **Eu** (recomendado — veja abaixo) |
| Quem pode acessar | **Qualquer pessoa da sua organização** |

Clique em **Implantar** e copie a **URL do app da Web**. É esse link que a
equipe usa, no computador ou no celular.

#### "Executar como: Eu" ou "Usuário que acessa"?

- **Eu (dono):** todos gravam usando a sua permissão. Não é preciso
  compartilhar a planilha com ninguém — mais simples de administrar, e o app
  continua registrando o e-mail de quem fez cada alteração.
- **Usuário que acessa:** cada pessoa grava com a própria conta e precisa ter
  **acesso de edição à planilha**. Use se a política da empresa exigir que a
  permissão de escrita seja individual.

### 6. Atalho na planilha (opcional)

Recarregue a planilha e vai aparecer o menu **CadastroSB › Abrir aplicativo**,
que abre o app numa janela sobre a planilha.

---

## Atualizando o app depois

Ao mudar o código, publique de novo: **Implantar › Gerenciar implantações ›
(lápis) › Versão: Nova versão › Implantar**. A URL continua a mesma.

## Estrutura da planilha

A aba `Cadastros` tem uma linha por componente:

| Coluna | Conteúdo |
| --- | --- |
| `ID` | Identificador interno (fica oculto — não edite) |
| `Equipamento` | Ex.: Slitter |
| `Parte` | Ex.: Desbobinador |
| `Componente` | Ex.: Motor desbobinador |
| `NI` | Número no sistema Usiminas |
| `Especialidade` | Mecânica ou Elétrica |
| `Responsavel` | Quem conduz o cadastro |
| `Status` | pendente, andamento, cadastro ou concluido |
| `Observacoes` | Anotações e comentários |
| `AtualizadoEm` | Data e hora da última alteração |
| `AtualizadoPor` | E-mail de quem alterou |

Você pode digitar direto na planilha, se preferir — o app lê as colunas **pelo
nome**, então reordená-las, filtrar ou montar tabela dinâmica não quebra nada.
Só não apague a coluna `ID` das linhas existentes: é por ela que o app sabe
qual linha editar. Uma linha inserida à mão sem ID aparece no app, mas para
editá-la por lá preencha um ID qualquer que seja único.

## A aba "Meus cadastros"

Cada colaborador escolhe o próprio nome uma vez, e a escolha fica guardada
**na conta Google** (`PropertiesService`) — então vale em qualquer aparelho,
não só naquele navegador. O app ainda tenta adivinhar quem é a pessoa
comparando o e-mail dela com os responsáveis já cadastrados.

No painel, as linhas de "Por responsável" abrem a aba daquela pessoa, o que
serve para o supervisor acompanhar a carga de cada um.

## Como o app se comporta com várias pessoas

- Toda gravação passa por uma **trava** (`LockService`): duas pessoas salvando
  ao mesmo tempo não se sobrescrevem.
- Depois de cada gravação o servidor devolve a **lista completa e atualizada**,
  então você já enxerga o que os colegas salvaram nesse intervalo.
- O botão **Atualizar da planilha** força uma releitura a qualquer momento.
- As validações (NI obrigatório para "Em cadastro" e "Concluído", NI não
  repetido) rodam **no servidor**, então valem mesmo se alguém abrir o app em
  duas abas ou digitar direto na planilha pelo app.

## Sobre as fontes

Aqui as fontes **Archivo** e **IBM Plex Mono** vêm do Google Fonts por `<link>`,
não embutidas no CSS. É o que mantém `Estilos.html` em ~34 KB em vez de 117 KB,
e dentro do Apps Script elas carregam sem problema.

A versão local (pasta raiz do repositório) faz o contrário: embute as fontes
para funcionar offline e dentro da prévia do Claude, que bloqueia CDNs.

## Limites que valem conhecer

- Apps Script tem cota de tempo de execução; na prática a planilha aguenta bem
  alguns milhares de linhas. Acima disso convém paginar a leitura.
- O aviso "app não verificado" aparece só na primeira autorização.
- Quem usar precisa estar logado numa conta Google da organização, conforme o
  que você escolheu em "Quem pode acessar".
