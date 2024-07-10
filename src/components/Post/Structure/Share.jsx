import SuccessAlert from "@/components/Alert/Success";
import ErrorAlert from "@/components/Alert/Error";
import React, { useState } from "react";
import Swal from "sweetalert2";

function Share(props) {
  const [success] = useState(null);
  const [error] = useState(null);

  const handleCopyLink = (event) => {
    const postLink = event.currentTarget.parentElement.parentElement.previousSibling.href;
    navigator.clipboard.writeText(postLink);

    Swal.fire({
      icon: "success",
      title: "Link copied",
      showConfirmButton: false,
      timer: 1000
    });
  };

  return (
    <div className="align-self-center mx-2 my-1">
      <button
        className="d-flex py-0 btn post-buttons"
        onClick={handleCopyLink}>
        <svg xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          className="m-0 align-self-center bi bi-share"
          viewBox="0 0 16 16">
          <path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5m-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"/>
        </svg>
        <p className="mx-2 mb-0">Share</p>
      </button>
      {success && <SuccessAlert success={success} />}
      {error && <ErrorAlert error={error} />}
    </div>
  );
}

export default Share;