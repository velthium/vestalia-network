import PropTypes from "prop-types";
import Image from "next/image";
import React from "react";

function Error(props) {
  return (
    <div className="h-100 d-flex flex-column align-items-center justify-content-center">
      <div className="mt-5">
        <p className="h2 text-center">{ props.message} </p>
        <Image
          src="/images/AlexandriaLibrary.webp"
          alt="Library of Alexandria"
          width="860"
          height="280"
          priority={true} />
      </div>
    </div>
  );
}

Error.propTypes = {
  message: PropTypes.string.isRequired
};

export default Error;