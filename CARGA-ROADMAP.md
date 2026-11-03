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

- [ ] Criar conta e entrar (e-mail, Google)
- [ ] Treinos, planos e medidas salvos na nuvem e sincronizados entre celular e computador
- [ ] Perfil: nome, foto, academia, público ou privado
- [ ] Continuar funcionando sem internet (sincroniza quando voltar)
- [ ] Exportar e apagar a conta (LGPD)

**Pronto quando:** você treina no celular e vê o treino no computador.

## Fase 3 — Social e desafios (ideias do GymRats e do Rivlo)

- [ ] Seguir amigos e ver os treinos deles
- [ ] **Check-in com foto** do treino do dia, com os números por cima (cartão de compartilhar)
- [ ] **Grupos** por link de convite (turma, família, academia), até 50 pessoas
- [ ] **Pontos**: por treino feito, sequência de dias, recordes e volume levantado
- [ ] **Ranking** do grupo, semanal e mensal
- [ ] **Botão de cutucar** o amigo que ainda não treinou hoje
- [ ] **Guerra de grupos**: um grupo desafia outro por uma semana, com placar ao vivo
- [ ] **Ligas por temporada**: Bronze → Prata → Ouro → Diamante → Lenda
- [ ] **Antitrapaça**: limites de carga e de frequência que façam sentido, denúncia no grupo
- [ ] Notificações: cutucada, guerra começando, alguém te passou no ranking

**Pronto quando:** você e um amigo disputam uma semana e o app mostra quem venceu.

## Fase 4 — Corrida (ideias do Strava)

- [ ] Gravar corrida e caminhada com GPS: distância, ritmo, tempo, parciais, mapa do percurso
- [ ] Na web com a tela ligada; no app Android também com a tela desligada
- [ ] Corridas contam pontos nos grupos e nas guerras
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
