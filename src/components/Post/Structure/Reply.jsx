'use client';

import { ReplySetting } from "@desmoslabs/desmjs-types/desmos/posts/v3/models";
import SuccessAlert from "@/components/Alert/Success";
import ErrorAlert from "@/components/Alert/Error";
import { useQuery } from "@tanstack/react-query";
import { request, gql } from "graphql-request";
import { useRouter, useParams } from 'next/navigation';
import Loading from "@/components/Loading";
import Keplr from "@/utils/Wallet/Keplr";
import React, { useState } from "react";
import ReplyDesign from "./ReplyDesign";
import IpfsAdd from "@/utils/Ipfs/Add";

const REPLY_QUERY = gql`
  query GetPostsAndSections($post_row_id: bigint!) {
    post(where: { text: { _is_null: true }, conversation_row_id: { _eq: $post_row_id } }) {
      id
      text
      owner_address
      conversation_row_id
      subspace_section {
        name
        id
      }
      reactions {
        id
        value
        post_row_id
      }
      post_urls {
        url
      }
    }
  }
`;

function Reply({ postId, communityId, postRowId }) {
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["postHomepage", postRowId],
    queryFn: async () => request("http://localhost:8080/v1/graphql/", REPLY_QUERY, { post_row_id: postRowId }),
    enabled: !!postRowId,  // Ensure query is only run when postRowId is available
  });

  const router = useRouter();

  console.log("postRowId:", postRowId);

  // Create a new post on the blockchain
  const handleCreateReply = async (e) => {
    try {
      e.preventDefault();

      const formData = new FormData(e.target);
      const keplrData = await Keplr();

      const uploadResponse = await IpfsAdd(formData.get("post-content"));

      // The definition of the message MsgCreatePost
      const MsgCreatePost = {
        typeUrl: "/desmos.posts.v3.MsgCreatePost",
        value: {
          subspaceId: 21,
          section_id: communityId,
          author: keplrData.signer.accountData.address,
          replySettings: ReplySetting.REPLY_SETTING_EVERYONE,
          entities: {
            urls: [{
              start: "0",
              end: "1",
              url: "https://ipfs.desmos.network/ipfs/" + uploadResponse.Name,
              display_url: "IPFS"
            }]
          },
          conversationId: postId
        }
      };

      const result = await keplrData.signAndBroadcast(MsgCreatePost.value.author, [MsgCreatePost], "auto");

      setSuccess(result);
      router.push("/");
    } catch (err) {
      setError(err);
    }
  };

  if (isLoading) return <Loading />;
  if (isError) return <ErrorAlert error={queryError.message} />;

  return (
    <div className="container p-0 p-lg-1">
      <h2 id="comments" className="m-3 h4 my-3 pt-5 custom-orange">Comments</h2>
      {data.post.map((post, index) => (
        <ReplyDesign key={post.id} post={post} index={index} post_page={false} />
      ))}
      <form action="" onSubmit={handleCreateReply}>
        <input className="form-control my-3" name="post-content" placeholder="Reply" />
        <button className="btn btn-secondary" type="submit">Submit</button>
      </form>
      {success && <SuccessAlert success={success} />}
      {error && <ErrorAlert error={error.message} />}
    </div>
  );
}

export default Reply;
