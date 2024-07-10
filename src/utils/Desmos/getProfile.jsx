async function GetProfile(address) {
    const response = await fetch(`https://api.mainnet.desmos.network/desmos/profiles/v3/profiles/${address}`);
  
    if (response.ok) {
      const data = await response.json();
  
      const DesmosProfile = {
        dtag: data.profile.dtag,
        nickname: data.profile.nickname,
        bio: data.profile.bio
      };
  
      return DesmosProfile;
    }
  }
  
  export default GetProfile;