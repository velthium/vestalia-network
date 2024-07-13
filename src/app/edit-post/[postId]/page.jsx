"use client";

import { useQuery } from "@tanstack/react-query";
import PostEdit from "@/components/Post/Edit";
import { request, gql } from "graphql-request";
import { useParams } from 'next/navigation';
import Loading from "@/components/Loading";
import React from "react";

const CreatePostPage = () => {
  const { postId } = useParams();

  const CONTENT_POST = gql`
  query getPost($id: bigint!) {
    post(where: { id: { _eq: $id }, text: { _is_null: false } }) {
      id
      text
      owner_address
      row_id
      subspace_section {
        name
        id
      }
      post_urls {
        url
      }
      reactions {
        id
        value
        post_row_id
      }
    }
  }
`;

  // Fetch specific post with its id
  const { data: specificPost, isLoading, isError } = useQuery({
    queryKey: ["specificPost", postId],
    queryFn: async () => request("http://localhost:8080/v1/graphql/", CONTENT_POST, { id: postId }).then(res => res.post[0]),
    enabled: !!postId,
  });

  if (isLoading) return <Loading />;
  if (isError) return <Error message="Error fetching posts and communites." />;

  return <PostEdit isEdit={true} postId={postId} specificPost={specificPost} />;
};

export default CreatePostPage;
