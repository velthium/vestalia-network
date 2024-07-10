async function Get(ipfsPath) {
    try {
      const response = await fetch(ipfsPath);
  
      if (!response.ok) {
        throw new Error(`Erreur lors de la demande: ${response.statusText}`);
      }
  
      const responseData = await response.json();
  
      return responseData.content;
    } catch (error) {
      console.error("Erreur lors du téléchargement du fichier :", error);
    }
  };
  
  export default Get;