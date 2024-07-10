import SuccessAlert from "@/components/Alert/Success";
import ErrorAlert from "@/components/Alert/Error";
import Keplr from "@/utils/Wallet/Keplr";
import { useRouter } from "next/router";
import React, { useState } from "react";
import PropTypes from "prop-types";
import Long from "long";

function Delete(props) {
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const handleDeletePost = async () => {
    try {
      const keplrData = await Keplr();

      const deletePost = {
        typeUrl: "/desmos.posts.v3.MsgDeletePost",
        value: {
          subspaceId: Long.fromNumber(21),
          postId: Long.fromNumber(props.postId),
          signer: keplrData.signer.accountData.address
        }
      };

      const result = await keplrData.signAndBroadcast(deletePost.value.signer, [deletePost], "auto");

      setSuccess(result);

      router.push(`/user/${keplrData.signer.accountData.address}/posts`);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="align-self-center my-1">
      <button
        className="d-flex p-0 btn"
        onClick={handleDeletePost}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          className="align-self-center bi bi-trash"
          viewBox="0 0 16 16">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
        </svg>
        <p className="ms-1 mb-0">Delete</p>
      </button>
      {success && <SuccessAlert success={success} />}
      {error && <ErrorAlert error={error} />}
    </div>
  );
}

Delete.propTypes = {
  postId: PropTypes.number.isRequired
};

export default Delete;