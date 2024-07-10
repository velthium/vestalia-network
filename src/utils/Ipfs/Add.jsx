async function Add(content) {
    const jsonData = {
      content
    };
  
    const formData = new FormData();
    formData.append("json_data", JSON.stringify(jsonData));
    try {
      const params = new URLSearchParams({
        quiet: true
      });
  
      const response = await fetch(`https://ipfs.desmos.network/api/v0/add?${params.toString()}`, {
        method: "POST",
        body: formData
      });
  
      if (!response.ok) {
        throw new Error(`Error during the demand: ${response.statusText}`);
      }
  
      const responseData = await response.json();
  
      return responseData;
    } catch (error) {
      console.error("Error during the download of the file :", error);
    }
  };
  
  export default Add;