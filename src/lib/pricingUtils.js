export async function fetchJklPrice() {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=jackal-protocol&vs_currencies=usd');
  if (!res.ok) throw new Error('Error while fetching JKL price');
  const data = await res.json();
  return data['jackal-protocol'].usd;
}

export function storageAsRawUsd(years, tb, ref) {
  const mod = years < 1 ? (ref ? 0.90 : 1) : (ref ? 0.95 : 1);

  if (years < 1) {
    if (tb >= 20) return years * tb * 150 * mod;
    if (tb >= 5) return years * tb * 168 * mod;
    return years * tb * 180 * mod;
  } else {
    if (tb >= 20) return years * tb * 125 * mod;
    if (tb >= 5) return years * tb * 140 * mod;
    return years * tb * 150 * mod;
  }
}

export function storageAsUsd(years, tb, ref) {
  const usd = storageAsRawUsd(years, tb, ref);
  return usd.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

export async function storageAsJkl(years, tb, ref) {
  const jklPrice = await fetchJklPrice();
  const usd = storageAsRawUsd(years, tb, ref);
  return `~${(usd / jklPrice).toLocaleString(undefined, {
    maximumFractionDigits: 2
  })} JKL`;
}
