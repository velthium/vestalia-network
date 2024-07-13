const profileCache = new Map();

async function fetchProfile(address) {
  if (profileCache.has(address)) {
    return profileCache.get(address);
  }

  const response = await fetch(`https://api.mainnet.desmos.network/desmos/profiles/v3/profiles/${address}`);
  
  if (response.ok) {
    const data = await response.json();

    const DesmosProfile = {
      dtag: data.profile.dtag,
      nickname: data.profile.nickname,
      bio: data.profile.bio
    };

    profileCache.set(address, DesmosProfile);

    return DesmosProfile;
  }

  throw new Error('Failed to fetch profile');
}

export default fetchProfile;
