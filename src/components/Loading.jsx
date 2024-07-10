import React from 'react';
import { ClipLoader } from 'react-spinners';

const Loading = () => {
  return (
    <div className="d-flex justify-content-center align-items-center vh-100 text-center">
      <div>
        <ClipLoader size={50} color={"#123abc"} loading={true} />
        <div>Loading...</div>
      </div>
    </div>
  );
};

export default Loading;
