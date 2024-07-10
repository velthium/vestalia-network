"use client";

import { ReplySetting } from "@desmoslabs/desmjs-types/desmos/posts/v3/models";
import { useRouter } from 'next/navigation';
import SuccessAlert from "@/components/Alert/Success";
import Keplr from "@/utils/Wallet/Keplr";
import ErrorAlert from "@/components/Alert/Error";
import PageTitle from "@/components/Title";
import React, { useState, useEffect } from "react";
import IpfsAdd from "@/utils/Ipfs/Add";
import PropTypes from 'prop-types';

const CreatePost = ({ isEdit, postId, communityId, communityName }) => {
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [post, setPost] = useState({ title: '', content: '' });
  const router = useRouter(); // Ensure router is defined here

  useEffect(() => {
    if (isEdit && postId) {
      const fetchPost = async () => {
        try {
          const response = await fetch(`/api/posts/${postId}`);
          const data = await response.json();
          setPost(data);
        } catch (err) {
          setError(err);
        }
      };

      fetchPost();
    }
  }, [isEdit, postId]);

  const handleSubmit = async (e) => {
    try {
      e.preventDefault();

      const formData = new FormData(e.target);
      const keplrData = await Keplr();

      const uploadResponse = await IpfsAdd(formData.get("post-content"));

      const MsgPost = {
        typeUrl: "/desmos.posts.v3.MsgCreatePost",
        value: {
          subspaceId: 21,
          sectionId: communityId,
          post_id: postId,
          text: formData.get("post-title"),
          author: keplrData.signer.accountData.address,
          replySettings: ReplySetting.REPLY_SETTING_EVERYONE,
          entities: {
            urls: [{
              start: "0",
              end: "1",
              url: "https://ipfs.desmos.network/ipfs/" + uploadResponse.Name,
              display_url: "IPFS"
            }]
          }
        }
      };

      const result = await keplrData.signAndBroadcast(MsgPost.value.author, [MsgPost], "auto");

      setSuccess(result);
      router.push("/"); // Ensure router is used correctly here
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="container p-0 p-lg-1">
      <PageTitle title={isEdit ? "Edit Post" : `Create Post in ${communityName}`} />
      <div className="bg-white">
        <form className="align-left" onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="fname">Post title:</label>
            <input className="form-control" type="text" name="post-title" placeholder="Post title" defaultValue={post.title} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="fname">Post content:</label>
            <textarea className="form-control" name="post-content" placeholder="Post content" rows="8" defaultValue={post.content} />
          </div>
          <button className="btn btn-info text-light" type="submit">Submit</button>
        </form>
        {success && <SuccessAlert success={success} />}
        {error && <ErrorAlert error={error} />}
      </div>
    </div>
  );
};

CreatePost.propTypes = {
  isEdit: PropTypes.bool,
  postId: PropTypes.string,
  communityId: PropTypes.string,
  communityName: PropTypes.string,
};

export default CreatePost;
