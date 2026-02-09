export interface DeckCounts {
  [rank: number]: number;
}

export interface Payouts {
  banker: number;
  player: number;
  tie: number;
  playerPair: number;
  bankerPair: number;
  tieBonus?: { [key: number]: number };
  bankerMode?: string;
}

export interface CalculationResult {
  player: { label: string; probability: number; payout: number; ev: number };
  banker: { label: string; probability: number; payout: number; ev: number };
  tie: { label: string; probability: number; payout: number; ev: number };
  playerPair: { label: string; probability: number; payout: number; ev: number };
  bankerPair: { label: string; probability: number; payout: number; ev: number };
  super6: { label: string; probability: number; payout: number; ev: number };
  tieBonuses: { label: string; probability: number; payout: number; ev: number }[];
  totalCards: number;
}

function getVal(rank: number): number {
  return rank >= 10 ? 0 : rank;
}

function calculatePairProbability(counts: DeckCounts, total: number): number {
  if (total < 2) return 0;
  let prob = 0;
  for (let rank = 1; rank <= 13; rank++) {
    const c = counts[rank];
    if (c >= 2) {
      prob += (c / total) * ((c - 1) / (total - 1));
    }
  }
  return prob;
}

export function calculateBaccaratEV(counts: DeckCounts, payouts: Payouts, commissionRate: number = 2.0): CalculationResult {
  const totalCards = Object.values(counts).reduce((a, b) => a + b, 0);

  // Super 6: Banker wins with 6 (2 cards)
  const super6Prob = 0;

  // 退水計算 (可調整)
  const commission = commissionRate / 100;

  if (totalCards < 6) {
    return {
      player: { label: '閒', probability: 0, payout: 0, ev: 0 },
      banker: { label: '莊', probability: 0, payout: 0, ev: 0 },
      tie: { label: '和', probability: 0, payout: 0, ev: 0 },
      playerPair: { label: '閒對', probability: 0, payout: 0, ev: 0 },
      bankerPair: { label: '莊對', probability: 0, payout: 0, ev: 0 },
      super6: { label: '超6', probability: 0, payout: 0, ev: 0 },
      tieBonuses: [],
      totalCards
    };
  }

  // Group cards by Baccarat values (0-9)
  const valCounts = new Array(10).fill(0);
  for (let rank = 1; rank <= 13; rank++) {
    valCounts[getVal(rank)] += counts[rank];
  }

  let pWinProb = 0, bWinProb = 0, tieProb = 0;
  let pPairProb = calculatePairProbability(counts, totalCards);
  let bPairProb = pPairProb;
  const tiePointProbs = new Array(10).fill(0);

  // Super 6 probabilities
  let tiger6_2_Prob = 0;
  let tiger6_3_Prob = 0;

  const getP = (val: number, currentCounts: number[], currentTotal: number) => {
    if (currentCounts[val] <= 0) return 0;
    return currentCounts[val] / currentTotal;
  };

  for (let p1 = 0; p1 <= 9; p1++) {
    const prob1 = getP(p1, valCounts, totalCards);
    if (prob1 === 0) continue;
    valCounts[p1]--;

    for (let b1 = 0; b1 <= 9; b1++) {
      const prob2 = prob1 * getP(b1, valCounts, totalCards - 1);
      if (prob2 === 0) continue;
      valCounts[b1]--;

      for (let p2 = 0; p2 <= 9; p2++) {
        const prob3 = prob2 * getP(p2, valCounts, totalCards - 2);
        if (prob3 === 0) continue;
        valCounts[p2]--;

        for (let b2 = 0; b2 <= 9; b2++) {
          const prob4 = prob3 * getP(b2, valCounts, totalCards - 3);
          if (prob4 === 0) continue;
          valCounts[b2]--;

          const pInit = (p1 + p2) % 10;
          const bInit = (b1 + b2) % 10;

          if (pInit >= 8 || bInit >= 8) {
            // 例牌
            if (pInit > bInit) {
              pWinProb += prob4;
            } else if (bInit > pInit) {
              bWinProb += prob4;
              // 超6：莊家6點勝（不論兩張或三張牌）
              if (bInit === 6) tiger6_2_Prob += prob4;
            } else {
              tieProb += prob4;
              tiePointProbs[pInit] += prob4;
            }
          } else {
            if (pInit <= 5) {
              for (let p3 = 0; p3 <= 9; p3++) {
                const prob5 = prob4 * getP(p3, valCounts, totalCards - 4);
                if (prob5 === 0) continue;
                valCounts[p3]--;
                const pFinal = (pInit + p3) % 10;

                let bDraw = false;
                if (bInit <= 2) bDraw = true;
                else if (bInit === 3 && p3 !== 8) bDraw = true;
                else if (bInit === 4 && p3 >= 2 && p3 <= 7) bDraw = true;
                else if (bInit === 5 && p3 >= 4 && p3 <= 7) bDraw = true;
                else if (bInit === 6 && (p3 === 6 || p3 === 7)) bDraw = true;

                if (bDraw) {
                  for (let b3 = 0; b3 <= 9; b3++) {
                    const prob6 = prob5 * getP(b3, valCounts, totalCards - 5);
                    if (prob6 === 0) continue;
                    const bFinal = (bInit + b3) % 10;
                    if (pFinal > bFinal) pWinProb += prob6;
                    else if (bFinal > pFinal) {
                      bWinProb += prob6;
                      if (bFinal === 6) tiger6_3_Prob += prob6;
                    } else {
                      tieProb += prob6;
                      tiePointProbs[pFinal] += prob6;
                    }
                  }
                } else {
                  if (pFinal > bInit) pWinProb += prob5;
                  else if (bInit > pFinal) {
                    bWinProb += prob5;
                    if (bInit === 6) tiger6_2_Prob += prob5;
                  } else {
                    tieProb += prob5;
                    tiePointProbs[pFinal] += prob5;
                  }
                }
                valCounts[p3]++;
              }
            } else {
              if (bInit <= 5) {
                for (let b3 = 0; b3 <= 9; b3++) {
                  const prob5 = prob4 * getP(b3, valCounts, totalCards - 4);
                  if (prob5 === 0) continue;
                  const bFinal = (bInit + b3) % 10;
                  if (pInit > bFinal) pWinProb += prob5;
                  else if (bFinal > pInit) {
                    bWinProb += prob5;
                    if (bFinal === 6) tiger6_3_Prob += prob5;
                  } else {
                    tieProb += prob5;
                    tiePointProbs[pInit] += prob5;
                  }
                }
              } else {
                if (pInit > bInit) pWinProb += prob4;
                else if (bInit > pInit) {
                  bWinProb += prob4;
                  if (bInit === 6) tiger6_2_Prob += prob4;
                } else {
                  tieProb += prob4;
                  tiePointProbs[pInit] += prob4;
                }
              }
            }
          }
          valCounts[b2]++;
        }
        valCounts[p2]++;
      }
      valCounts[b1]++;
    }
    valCounts[p1]++;
  }

  // EV 計算公式：機率 * (赔率 + 1) - 1 + 退水/2
  const evP = pWinProb * payouts.player - bWinProb + (commission / 2);
  const evB = bWinProb * payouts.banker - pWinProb + (commission / 2);
  const evT = tieProb * payouts.tie - (1 - tieProb) + (commission / 2);
  const evPPair = pPairProb * (payouts.playerPair + 1) - 1 + (commission / 2);
  const evBPair = bPairProb * (payouts.bankerPair + 1) - 1 + (commission / 2);
  // 超6：莊6點贏（不論兩張或三張牌）赔12倍
  const evSuper6 = (tiger6_2_Prob + tiger6_3_Prob) * 12 - (1 - tiger6_2_Prob - tiger6_3_Prob) + (commission / 2);

  return {
    player: { label: '閒', probability: pWinProb, payout: payouts.player, ev: evP },
    banker: { label: '莊', probability: bWinProb, payout: payouts.banker, ev: evB },
    tie: { label: '和', probability: tieProb, payout: payouts.tie, ev: evT },
    playerPair: { label: '閒對', probability: pPairProb, payout: payouts.playerPair, ev: evPPair },
    bankerPair: { label: '莊對', probability: bPairProb, payout: payouts.bankerPair, ev: evBPair },
    super6: { label: '超6', probability: tiger6_2_Prob + tiger6_3_Prob, payout: payouts.super6, ev: evSuper6 },
    tieBonuses: [],
    totalCards
  };
}
