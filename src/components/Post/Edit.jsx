"use client";

import { ReplySetting } from "@desmoslabs/desmjs-types/desmos/posts/v3/models";
import { useRouter } from 'next/navigation';
import SuccessAlert from "@/components/Alert/Success";
import Keplr from "@/utils/Wallet/Keplr";
import ErrorAlert from "@/components/Alert/Error";
import PageTitle from "@/components/Title";
import React, { useState, useEffect } from "react";
import GetIpfs from "@/utils/Ipfs/Get";
import IpfsAdd from "@/utils/Ipfs/Add";
import PropTypes from 'prop-types';

const EditPost = ({ postId, communityId, communityName, specificPost }) => {
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [post, setPost] = useState({ title: '', content: '' });
  const [textpost, setTextpost] = useState();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ipfsContent = await GetIpfs(specificPost.post_urls[0].url);
        setTextpost(ipfsContent);
      } catch (error) {
        console.error("Erreur lors de la récupération des données depuis IPFS :", error);
      }
    };

    fetchData();

  }, []);

  const handleSubmit = async (e) => {
    try {
      e.preventDefault();

      const formData = new FormData(e.target);
      const keplrData = await Keplr();

      const uploadResponse = await IpfsAdd(formData.get("post-content"));

      const MsgPost = {
        typeUrl: "/desmos.posts.v3.MsgEditPost",
        value: {
          subspaceId: 21,
          sectionId: communityId,
          postId: postId,
          text: formData.get("post-title"),
          editor: keplrData.signer.accountData.address,
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

      const result = await keplrData.signAndBroadcast(MsgPost.value.editor, [MsgPost], "auto");

      setSuccess(result);
      router.push("/"); // Redirect to root
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="container p-0 p-lg-1">
      <PageTitle title={`Edit Post in ${specificPost.subspace_section.name}`} />
      <div className="bg-white">
        <form className="align-left" onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="post-title">Post title:</label>
            <input className="form-control" type="text" name="post-title" placeholder="Post title" defaultValue={specificPost.text} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="post-content">Post content:</label>
            <textarea className="form-control" name="post-content" placeholder="Post content" rows="8" defaultValue={textpost} />
          </div>
          <button className="btn btn-info text-light" type="submit">Submit</button>
        </form>
        {success && <SuccessAlert success={success} />}
        {error && <ErrorAlert error={error} />}
      </div>
    </div>
  );
};

EditPost.propTypes = {
  postId: PropTypes.string.isRequired,
  communityId: PropTypes.string.isRequired,
  communityName: PropTypes.string.isRequired,
};

export default EditPost;
