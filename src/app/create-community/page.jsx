"use client";

import SuccessAlert from "@/components/Alert/Success";
import ErrorAlert from "@/components/Alert/Error";
import { useRouter } from 'next/navigation';
import PageTitle from "@/components/Title";
import Keplr from "@/utils/Wallet/Keplr";
import React, { useState } from "react";
import Long from "long";

function CreateCommunity() {
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Save the profile data in the blockchain
  const handleSaveProfile = async (e) => {
    try {
      e.preventDefault();
      const formData = new FormData(e.target);
      const keplrData = await Keplr();

      const createSection = {
        typeUrl: "/desmos.subspaces.v3.MsgCreateSection",
        value: {
          subspaceId: Long.fromNumber(21),
          name: formData.get("community-name"),
          description: formData.get("community-description"),
          creator: keplrData.signer.accountData.address
        }
      };

      const result = await keplrData.signAndBroadcast(createSection.value.creator, [createSection], "auto");
      setSuccess(result);
      router.push("/");
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="container p-0 p-lg-1">
      <PageTitle title="Create community" />
      <div>
        <form
          className="align-left"
          onSubmit={handleSaveProfile}>
          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="fname">Community name:
            </label>
            <textarea
              className="form-control"
              type="text"
              name="community-name"
              placeholder="Community name" />
          </div>
          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="fname">
              Community description:
            </label>
            <textarea
              className="form-control"
              type="text"
              name="community-description"
              placeholder="Community description" />
          </div>
          <button
            className="btn btn-info text-light"
            type="submit">Submit
          </button>
        </form>
        {success && <SuccessAlert success={success} />}
        {error && <ErrorAlert error={error} />}
      </div>
    </div>
  );
}

export default CreateCommunity;