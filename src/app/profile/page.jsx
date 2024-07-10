'use client';

import React, { useContext, useState, useEffect } from "react";
import SuccessAlert from "@/components/Alert/Success";
import Keplr from "@/utils/Wallet/Keplr";
import ErrorAlert from "@/components/Alert/Error";
import PageTitle from "@/components/Title";
import { AuthContext } from "@/contexts/Auth";
import { useRouter } from 'next/navigation';

function ProfilePage() {
  const { authData, setAuthData } = useContext(AuthContext);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const [formValues, setFormValues] = useState({
    username: authData.desmosProfile?.nickname,
    dtag: authData.desmosProfile?.dtag,
    bio: authData.desmosProfile?.bio
  });

  useEffect(() => {
    setFormValues({
      username: authData.desmosProfile?.nickname,
      dtag: authData.desmosProfile?.dtag,
      bio: authData.desmosProfile?.bio
    });
  }, [authData.desmosProfile?.nickname, authData.desmosProfile?.dtag, authData.desmosProfile?.bio]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData(e.target);
      const keplrData = await Keplr();

      const saveProfile = {
        typeUrl: "/desmos.profiles.v3.MsgSaveProfile",
        value: {
          creator: keplrData.signer.accountData.address,
          bio: formData.get("bio"),
          dtag: formData.get("dtag"),
          nickname: formData.get("username"),
          coverPicture: "https://ipfs.io/ipfs/<CID>",
          profilePicture: "https://ipfs.io/ipfs/<CID>"
        }
      };

      const result = await keplrData.signAndBroadcast(saveProfile.value.creator, [saveProfile], "auto");
      setSuccess(result);
    } catch (err) {
      setError(err);
    }
  };

  const handleClearSessionStorage = () => {
    sessionStorage.clear();
    setAuthData({});
    router.push("/");
  };

  const MyPostsPage = () => {
    router.push(`/user/${authData.walletSigner.accountData.address}/posts`);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prevValues) => ({
      ...prevValues,
      [name]: value
    }));
  };

  return (
    <div className="container p-0 p-lg-1">
      <PageTitle title="Modify your profile" />
      <div className="text-center">
        <form className="align-left" onSubmit={handleSaveProfile}>
          <div className="mb-3">
            <label className="form-label" htmlFor="username">Username:</label>
            <input
              className="form-control"
              type="text"
              name="username"
              id="username"
              value={formValues.username}
              onChange={handleInputChange}
              placeholder="Enter a username"
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="dtag">Dtag:</label>
            <input
              className="form-control"
              type="text"
              name="dtag"
              id="dtag"
              value={formValues.dtag}
              onChange={handleInputChange}
              placeholder="Enter a dtag"
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="bio">Bio:</label>
            <textarea
              className="form-control"
              type="text"
              name="bio"
              id="bio"
              value={formValues.bio}
              onChange={handleInputChange}
              placeholder="Enter a bio"
            />
          </div>
          <button className="btn btn-info text-light" type="submit">Submit</button>
        </form>
        {success && <SuccessAlert success={success} />}
        {error && <ErrorAlert error={error} />}
        <button className="btn btn-secondary text-light" onClick={MyPostsPage}>Your posts</button>
        <button className="btn btn-danger text-light m-2" onClick={handleClearSessionStorage}>Logout</button>
      </div>
    </div>
  );
}

export default ProfilePage;
