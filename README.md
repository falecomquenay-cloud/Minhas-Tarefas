# CadastroSB — Controle de Cadastro de Sobressalentes

> **Duas versões**
>
> - **Local** (esta pasta): arquivo HTML aberto no navegador, dados salvos no
>   próprio aparelho. Bom para uso individual e para testar.
> - **Google Apps Script** ([`apps-script/`](apps-script/)): mesma interface,
>   com **planilha Google como banco de dados** — vários usuários ao mesmo
>   tempo, dados na nuvem e registro de quem alterou o quê.
>   Instalação em [`apps-script/README.md`](apps-script/README.md).

Aplicação para **acompanhar o cadastramento de sobressalentes no sistema
Usiminas**. Não é controle de estoque de almoxarifado: o objetivo é saber
**o que já foi cadastrado, o que está em andamento e o que ainda falta**, por
equipamento, por responsável e por especialidade.

## Estrutura do cadastro

Cada registro segue a hierarquia **Equipamento › Parte › Componente**:

| Nível | Exemplo |
| --- | --- |
| Equipamento | Slitter |
| Parte | Desbobinador |
| Componente | Motor desbobinador |

### Campos

- **NI** — número cadastrado no sistema Usiminas
- **Status** — quatro etapas, na ordem do trabalho:

  | Status | Significa |
  | --- | --- |
  | Pendente | ainda não iniciado |
  | Em andamento | em levantamento |
  | Em cadastro | já tem ID de cadastro no sistema |
  | Concluído | cadastro finalizado |

- **Responsável** — quem conduz o cadastro
- **Especialidade** — Mecânica ou Elétrica
- **Observações e comentários** — pendências, referências do fabricante, notas

## As quatro telas

### 01 · Painel de evolução
Faixa com cinco indicadores (total, concluídos com %, em cadastro, em andamento
e pendentes) e o progresso em três recortes — **por equipamento**, **por
responsável** e **por especialidade** — com barra segmentada: verde = concluído,
azul = em cadastro, laranja = em andamento, cinza = pendente.

As linhas de equipamento abrem a ficha correspondente; as de responsável abrem
a aba daquela pessoa.

### 02 · Meus cadastros
Cada colaborador vê **só o que está sob sua responsabilidade**. Na primeira
visita o app pergunta quem é a pessoa e guarda a escolha. Traz indicadores
próprios, filtros de busca, especialidade e status — já aberto em **"Em
aberto"**, que é o que ela precisa resolver — e os componentes agrupados por
equipamento.

### 03 · Equipamentos
Cartões com o percentual concluído, barra de progresso, contagem por status e
as especialidades envolvidas. Abrir um cartão leva à **ficha do equipamento**:

- Cabeçalho com o percentual e o resumo
- Componentes **agrupados por Parte**, cada bloco com seu próprio progresso
- Blocos de Parte recolhíveis
- **"+ Adicionar componente em «Parte»"** já abre o formulário preenchido
- **Renomear** ou **excluir** uma parte inteira, e o mesmo para o equipamento

### 04 · Todos os cadastros
A lista completa, com filtros combinados por equipamento, especialidade,
status e responsável. No celular a tabela vira fichas.

## Regras aplicadas ao salvar

- Equipamento, Parte e Componente são obrigatórios
- **Em cadastro** e **Concluído** exigem o NI preenchido
- O mesmo NI não pode ser usado em dois componentes

Os campos de equipamento, parte e responsável sugerem valores já usados,
evitando que o mesmo item entre grafado de formas diferentes.

## Como usar a versão local

Abra `index.html` no navegador — nenhuma dependência. Para servir via HTTP:

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

Na primeira execução entram dados de exemplo. Use **Exportar dados** para gerar
um backup em JSON e **Importar dados** para restaurar.

> Os dados ficam no `localStorage` do navegador — locais àquele navegador e
> àquele computador. Exporte com regularidade, ou use a versão Apps Script.

## Arquivos

| Arquivo | Descrição |
| --- | --- |
| `index.html` | Estrutura da interface |
| `fontes.css` | Archivo e IBM Plex Mono embutidas (data URI) |
| `styles.css` | Estilos e layout responsivo |
| `app.js` | Lógica, agregações do painel e persistência |
| `apps-script/` | Versão com planilha Google como banco |

## Tecnologia

HTML, CSS e JavaScript puro — sem frameworks nem etapa de build.

Identidade editorial com papel quente, fios de 1px e tipografia **Archivo**
(texto) com **IBM Plex Mono** (rótulos e números). Na versão local as fontes
vão embutidas como data URI, então a interface não faz nenhuma chamada externa
e funciona offline. Alvos de toque adequados no celular e suporte a
`prefers-reduced-motion`.
