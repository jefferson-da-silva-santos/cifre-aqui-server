# Correções — servidor e frontend

Duas pastas: `servidor/` sobre `cifre-aqui-server/` e `frontend/` sobre o projeto
React. Os caminhos internos já são os finais.

**Antes de subir o servidor:**

```bash
npx prisma migrate deploy     # duas migrações novas
npx puppeteer browsers install chrome
```

---

## 1. Refresh token derrubando a sessão

A rotação estava certa; a detecção de roubo é que era cega.

`refresh()` invalida o token usado e emite outro. Se um token já revogado
reaparece, o serviço trata como replay e encerra **todas** as sessões. O problema
é que "token revogado" era a única informação disponível — e retry legítimo e
roubo produzem exatamente esse mesmo estado:

- **React em StrictMode monta cada efeito duas vezes** em desenvolvimento, e o
  `SessionGate` disparava dois refresh no mesmo instante. Essa é a causa direta
  do erro a cada recarregamento;
- duas abas recarregando juntas usam o mesmo cookie;
- a requisição falha na rede depois de o servidor já ter rotacionado, e o cliente
  repete com o token antigo.

### Servidor

`RefreshToken` ganhou `replacedByTokenHash` (migração
`20260829120000_refresh_token_rotation_grace`). Com o sucessor registrado, dá
para distinguir os dois casos: reutilizar um token rotacionado **há menos de 30
segundos e com sucessor conhecido** é retry, e responde pedindo a repetição.
Fora disso continua sendo roubo, e continua encerrando tudo.

`AuthService` também guarda por 30s a sessão que cada rotação emitiu, para a
duplicata receber a **mesma** resposta em vez de uma segunda rotação — duas
respostas diferentes deixariam o cliente com dois refresh tokens vivos, e o
próximo uso de um deles pareceria replay.

Outra correção na mesma função: a revogação passou a acontecer **depois** de a
nova sessão ser emitida. Se a emissão falhasse, o usuário ficava sem token
nenhum.

> Em memória basta porque a janela é curta. Com várias instâncias sem sessão
> fixa, troque o `Map` por Redis com TTL — a interface é a mesma.

### Frontend

`garantirRefresh()` no `axiosInstance` mantém **uma** promessa de refresh em voo
para toda a aplicação. Ela vive no módulo, e não dentro do interceptor, porque o
interceptor não é o único a pedir refresh: o `SessionGate` também pede no boot.
O `SessionGate` ganhou ainda uma ref de primeira montagem, para o caso em que a
segunda montagem do StrictMode acontece depois de a primeira terminar — aí não
há mais nada em voo para compartilhar.

### Cookie

`sameSite` virou variável de ambiente. Estava fixo em `strict`, o que funciona em
`localhost` (a porta não conta para cookies) mas silenciosamente **não envia o
cookie** com frontend e API em domínios diferentes. `COOKIE_SAMESITE=none` cobre
esse caso e força `secure`. O cookie também ganhou `maxAge`: sem ele era cookie
de sessão, e "continuar logado" durava só enquanto a aba vivesse.

---

## 2. PDF: "Could not find Chrome"

O erro é de instalação — o Puppeteer não tem binário do Chrome nessa máquina:

```bash
npx puppeteer browsers install chrome
```

Se o cache `C:\Users\USER\.cache\puppeteer` não puder ser escrito, aponte para um
Chrome já instalado no `.env`:

```
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

Mas havia um bug real por trás disso. `_getBrowser()` memorizava a **promessa**
do lançamento, incluindo quando ele falhava:

```js
this._browserPromise = puppeteer.launch({...});   // rejeitada fica memorizada
```

Toda exportação seguinte recebia a mesma rejeição, mesmo depois de o Chrome ser
instalado — só reiniciar o servidor resolvia. É por isso que o erro parecia
permanente. Agora a promessa é limpa na falha, e também quando o browser morre
entre duas requisições (OOM, crash), para a próxima exportação subir uma nova.

O erro cru também vazava para o cliente como 500 com stack trace, expondo
caminhos do seu disco. Virou `503` com mensagem que diz o que aconteceu e deixa
claro que **nenhuma cobrança foi feita** — e 503 informa ao cliente que repetir
faz sentido, coisa que o 500 genérico não diz.

Ainda no lançamento: `--disable-dev-shm-usage` entrou para o Docker, cujo
`/dev/shm` padrão tem 64MB e trava o Chrome ao estourar.

---

## 3. `artista: Expected string, received null`

O `schemaCreateCifra` recusava `null`, mas o GET **devolve** `artista: null`
quando vazio. Como o autosave manda a cifra inteira de volta, qualquer edição
batia nesse 400. Agora o schema aceita `null` explicitamente: recusar o próprio
formato que a leitura produz obriga todo cliente a limpar o payload à mão.

---

## 4. Bloco "Final" com letra

`Final` saiu de `TIPOS_INSTRUMENTAIS`. A maioria dos hinos termina cantando, e
nascer como grade de acordes obrigava a converter o bloco toda vez. O caso raro
— final só instrumental — continua a um clique, pelo botão "sem letra".

Tirei **Ponte** junto: ponte com letra é o caso comum em hinário, e ponte
instrumental costuma se chamar Solo ou Instrumental, que continuam na lista.
Diga se prefere Ponte de volta como instrumental.

---

## 5. Símbolo "Nota"

Novo símbolo `✎` na paleta, ao lado de Parada, Pausa e Entrada. Ele é o único que
**pede texto** em vez de marcar posição: arraste-o para qualquer ponto da linha e
um campo discreto abre abaixo dela.

A distinção importa. Os outros símbolos viram `AcordePosicionado` e ficam **acima**
da sílaba, no lugar reservado à harmonia. A nota fala da linha inteira, não de um
ponto dela, então é gravada em `linha.nota` e sai abaixo — recuada e em itálico,
lendo como margem de caderno. O × de remover só aparece no hover: a nota é para
ser lida, não administrada.

Um detalhe de comportamento: `null` é "linha sem nota" e `""` é "nota recém-criada
ainda sem texto". Sem essa distinção, apagar o último caractere fecharia o campo
no meio da digitação.

No PDF, a nota entra **dentro** da unidade rígida da linha. Separada da linha a
que se refere, viraria uma frase solta no topo da página seguinte.

---

## 6. Observações do hino

Campo novo `observacoes` na cifra (migração `20260829130000_cifra_observacoes`),
com até 2000 caracteres. No editor fica depois de todos os blocos; no preview e
no PDF, no pé da folha, depois de toda a cifra e dos diagramas.

Campo próprio e não mais um bloco: a observação não pertence a nenhuma seção da
música, não tem acorde nem letra. Modelada como bloco, apareceria no meio do
hino. Discreta pelo mesmo motivo — quem está tocando lê a cifra de cima a baixo e
consulta isto uma vez, no começo do ensaio. `break-inside: avoid` mantém a
observação inteira numa página só.

---

## O que ficou de fora

`ExportacaoService` continua gerando o PDF **depois** de aprovar o pagamento no
fluxo pago. Como o 503 agora acontece antes de qualquer cobrança nos caminhos
gratuito e admin, o buraco restante é estreito: pagamento aprovado e Chrome cai
entre a aprovação e a renderização. Vale uma fila com retry, se quiser que eu
faça.
