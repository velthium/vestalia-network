export const fetchJklPrice = async () => {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=jackal-protocol&vs_currencies=usd');
  if (!res.ok) throw new Error('Error while fetching JKL price');
  return (await res.json())['jackal-protocol'].usd;
};

export const storageAsRawUsd = (years, tb, ref) => {
  const mod = years < 1 ? (ref ? 0.90 : 1) : (ref ? 0.95 : 1);
  const base = years < 1 ? (tb >= 20 ? 150 : tb >= 5 ? 168 : 180) : (tb >= 20 ? 125 : tb >= 5 ? 140 : 150);
  return years * tb * base * mod;
};

export const storageAsUsd = (years, tb, ref) => storageAsRawUsd(years, tb, ref).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const storageAsJkl = async (years, tb, ref) => {
  const usd = storageAsRawUsd(years, tb, ref);
  const jklPrice = await fetchJklPrice();
  return `~${(usd / jklPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })} JKL`;
};
