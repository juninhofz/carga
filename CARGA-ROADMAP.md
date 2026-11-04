# Roadmap da CARGA

App de treino brasileiro feito sobre o openGym (AGPL-3.0). Cada fase termina com algo que dá
para usar e testar. Uma fase só começa quando a anterior está pronta.

Legenda: [x] feito · [ ] a fazer

---

## Fase 0 — Base do app ✅

- [x] Marca CARGA: nome, paleta laranja, logo da barra que vira C
- [x] Animação de abertura (completa de 2,5 s na primeira vez, rápida depois)
- [x] App em português do Brasil desde o primeiro acesso
- [x] Publicado na web: https://carga-swart.vercel.app (dados ficam no aparelho)
- [x] Mídias da Gym visual retiradas (licença)
- [x] Animações próprias: boneco laranja com mapa de calor em todos os exercícios

## Sistema de Carga (ranks e missões) — planejado em 03/11/2026

Já feito: XP calculado do histórico, 2 desafios por semana + 3 por mês, carta de rank com 10 ranks
(E até Carga Máxima, nomes ainda provisórios), animação de subir de rank, carta grande ao tocar.

**A regra nova: a carta mostra como você está agora, não aonde já chegou.**

- [x] **Carga atual × histórico**: a Carga (pontos) sobe e desce e define nível e carta; o
      histórico (treinos, recordes, melhor rank já alcançado) nunca cai. A carta mostra um selo
      "melhor: Rank X".
- [x] **Queda lenta e proporcional**: toda semana a Carga perde uma pequena parte do que a pessoa
      tem na carta (ex.: 3%). Quem tem mais pontos perde mais em número, mas sempre devagar; quem
      treina normalmente ganha mais do que perde. Aviso na carta antes de cair de rank (rachada,
      sem brilho, "risco de cair para o Rank C").
- [x] **Cair de rank**: animação ao contrário ("SISTEMA · SUA CARGA CAIU") e a carta volta para
      o rank anterior.
- [x] **Modo pausa**: lesão ou férias congelam a Carga por até 4 semanas.
- [x] **Missões valem pouco, completar tudo vale muito**: cada missão 20–40 pontos; todas da
      semana = bônus grande; todas do mês = bônus maior; semanas completas seguidas multiplicam
      (×1,1, ×1,2… até ×1,5).
- [x] **Mais missões e mais difíceis a cada rank**: E 2 por semana, fáceis → S e acima 5,
      pesadas. Sempre medidas pelo histórico da própria pessoa.
- [x] **Tipos de missão**: constância, força (subir carga, recorde, volume), corrida e cardio
      (completas com o GPS da Fase 4), variedade (exercício novo, músculo esquecido),
      mobilidade, corpo (peso, medidas, foto) e, depois, em grupo.
- [x] **Missão diária opcional**: pequena, poucos pontos, para manter o hábito.
- [x] **Missão relâmpago**: aparece de surpresa e vale só por 24 horas.
- [ ] **Número exclusivo da carta**: o primeiro a chegar no Rank B no app inteiro é o "Nº 1" do
      Rank B, o segundo é o Nº 2, e assim por diante, para cada rank. O número é seu para sempre,
      mesmo se cair e voltar. Precisa de contas e servidor (Fase 2): até lá a carta mostra "Nº —".
- Decidido não ter: Exame de Rank (sobe só por pontos) e títulos permanentes por enquanto.

## Personal CARGA (plano personalizado) — começado em 04/11/2026

- [x] Questionário completo e adaptável (25 perguntas em 8 blocos: objetivo, você, agenda,
      esporte, equipamento, preferências, recuperação, observações livres)
- [x] Motor de regras de treinador (lib/personal/plan.js): divisão pelos dias, perna fora dos dias
      de luta, treino curto nos dias de esporte, exercícios pelo equipamento, sem os que doem ou que a
      pessoa não curte, prioridades musculares, necessidades do esporte, doses por objetivo,
      experiência e recuperação, explicação de cada escolha e como evoluir
- [x] Aula do esporte vira atividade na agenda e conta como cardio nas missões
- [x] Vários métodos guardados; trocar de método muda a semana
- [ ] Missões ligadas ao esporte (ex.: "vá às 3 aulas de jiu-jitsu")
- [x] Registro rápido da aula (foi/não foi, intensidade) e ajuste do treino do dia seguinte
- [ ] "Trocar o treino de hoje" com sugestões do método (rápido, só cardio, mobilidade)
- [ ] Fases até uma data (competição/viagem) e semanas leves automáticas
- [ ] Enviar as respostas e a observação livre para a nuvem (com conta) para analisarmos

## Fase 1 — Arrumar a casa (curta, e a primeira obrigação legal)

- [x] **Código aberto no GitHub**: https://github.com/juninhofz/carga (público, AGPL), sem as
      mídias da Gym visual nem o histórico do openGym. Link do código em Ajustes → Sobre.
- [ ] Ícones do Android e do iPhone com o logo da CARGA (hoje ainda é o haltere)
- [ ] Traduzir as descrições e o passo a passo dos exercícios que ainda aparecem em inglês
- [ ] Revisar as animações com a lista de exercícios que você achar estranhos
- [ ] Investigar os testes automáticos que falham (8 sem causa conhecida)

**Pronto quando:** o código está público, o app abre com o ícone novo e tudo aparece em português.

## Fase 2 — Contas e nuvem (Supabase, plano gratuito)

Hoje os dados ficam só no aparelho. Para ter amigos e desafios, cada pessoa precisa de uma conta.

- [x] Criar conta e entrar (e-mail, Google)
- [x] Treinos, planos e medidas salvos na nuvem e sincronizados entre celular e computador
- [x] Perfil: nome, foto, academia, público ou privado
- [ ] Continuar funcionando sem internet (sincroniza quando voltar)
- [ ] Exportar e apagar a conta (LGPD)

**Pronto quando:** você treina no celular e vê o treino no computador.

## Fase 3 — Social e desafios (ideias do GymRats e do Rivlo)

- [ ] Seguir amigos e ver os treinos deles
- [x] **Check-in com foto** do treino do dia, com os números por cima (cartão de compartilhar)
- [x] **Grupos** por link de convite (turma, família, academia), até 50 pessoas
- [x] **Pontos**: por treino feito, sequência de dias, recordes e volume levantado
- [x] **Ranking** do grupo, semanal e mensal
- [ ] **Botão de cutucar** o amigo que ainda não treinou hoje
- [ ] **Guerra de grupos**: um grupo desafia outro por uma semana, com placar ao vivo
- [ ] **Ligas por temporada**: Bronze → Prata → Ouro → Diamante → Lenda
- [ ] **Antitrapaça**: limites de carga e de frequência que façam sentido, denúncia no grupo
- [ ] Notificações: cutucada, guerra começando, alguém te passou no ranking

**Pronto quando:** você e um amigo disputam uma semana e o app mostra quem venceu.

## Fase 4 — Corrida (ideias do Strava)

- [x] Gravar corrida e caminhada com GPS: distância, ritmo, tempo, parciais, mapa do percurso
- [ ] Na web com a tela ligada; no app Android também com a tela desligada
- [x] Corridas contam pontos nos grupos e nas guerras
- [ ] Ranking de corrida separado (distância da semana)
- [ ] Importar do Health Connect (Android) e do Apple Saúde

**Pronto quando:** você corre com o celular no bolso e o percurso aparece no mapa e no grupo.

## Fase 5 — Lojas de aplicativos

- [ ] App Android na Google Play (o projeto já tem a base em Capacitor)
- [ ] App iPhone na App Store (precisa de conta de desenvolvedor da Apple, US$ 99 por ano)
- [ ] Notificações push de verdade
- [ ] Widget na tela inicial: sequência de dias e posição no ranking

**Pronto quando:** dá para baixar a CARGA na loja.

## Fase 6 — Extras (escolher depois)

- [ ] Treinador com IA que responde com os seus dados ("quanto falta para eu passar o Pedro?")
- [ ] Planos de treino montados por meta
- [ ] Modo artes marciais (rounds, cronômetro de luta, treinos de saco e sombra)
- [ ] Mais animações e poses revisadas exercício por exercício
- [ ] Como ganhar dinheiro, se quiser: plano Pro sem anúncios, ou parceria com academias

---

Ordem sugerida: 1 → 2 → 3 → 4 → 5 → 6. A Fase 1 vem primeiro porque o app já está no ar e a
licença pede o código público.

## Feito em 4 de novembro de 2026

- [x] Visual fosco: tema claro F e escuro K, barra de vidro, logo e foto do usuário
- [x] Corrida, caminhada e pedal com GPS, pace, parciais, mapa, voz e notificação na tela de bloqueio (web)
- [x] Menu do Começar: academia, GPS ou esporte com cronômetro (jiu-jitsu, muay thai...)
- [x] Status da atividade com animação (Pena, Firme, Pesado, Brutal, Carga Máxima)
- [x] Telas de compartilhar: mapa, escuro, laranja, com foto e adesivo
- [x] Ranks: sem perda em E e D, perda de 2% do C para cima, congelamento de 1 semana por mês
- [x] Desafios em grupo: criar, código e link, feed com fotos, reações, comentários, chat, ranking, equipes,
      post só com foto valendo metade, selo CARGA, 1º lugar com coroa e carta, foto e rank de cada pessoa
