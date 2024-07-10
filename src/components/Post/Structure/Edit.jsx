import { useRouter } from "next/navigation";
import React from "react";
import PropTypes from "prop-types";

function Edit(props) {
  const router = useRouter();

  const handleEditPost = () => {
    router.push(`/edit-post/${props.postId}`);
  };

  return (
    <div className="align-self-center">
      <button
        className="d-flex p-0 btn"
        onClick={handleEditPost}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          className="m-0 align-self-center bi bi-pen"
          viewBox="0 0 16 16">
          <path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z"/>
        </svg>
        <p className="ms-1 mb-0">Edit</p>
      </button>
    </div>
  );
}

Edit.propTypes = {
  postId: PropTypes.number.isRequired
};

export default Edit;
