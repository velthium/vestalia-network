'use client';

import { useQuery } from "@tanstack/react-query";
import Post from "@/components/Post/Structure/Index";
import { request, gql } from "graphql-request";
import PageTitle from "@/components/Title";
import { AuthContext } from "@/contexts/Auth";
import Error from "@/components/Alert/Error";
import React, { useContext } from "react";
import { useRouter, useParams } from 'next/navigation';
import Loading from "@/components/Loading";

const COMMUNITY_POSTS = gql`
  query getPostsFromSection($id: bigint!) {
    post(where: {subspace_section: {id: {_eq: $id}}}) {
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
    subspace_section {
      name
      id
    }
  }
`;

function Community() {
  const { authData } = useContext(AuthContext);
  const router = useRouter();
  const params = useParams();
  const communityname = params.communityName;
  const communityid = params.communityId;

  const handleInputClick = () => {
    router.push(`/community/${communityid}/${communityname}/create-post`);
  };

  const { data: communityPosts, isLoading, isError } = useQuery({
    queryKey: ["communityPost", communityid],
    queryFn: async () => request("http://localhost:8080/v1/graphql/", COMMUNITY_POSTS, { id: communityid }).then(res => res.post),
    enabled: !!communityid,  // Ensure query is only run when communityid is available
  });

  if (isLoading) return <Loading />;
  if (isError) return <div>Error fetching community post</div>;

  return (
    <div className="container">
      <PageTitle title={communityname} />
      {authData.desmosProfile && (
        <input
          className="form-control w-50 mb-5 m-auto"
          placeholder="Create post"
          onClick={handleInputClick} />
      )}
      <article>
        {communityPosts && communityPosts.length > 0 ? (
          communityPosts.map((post, index) => (
            <Post
              post={post}
              index={index}
              key={index}
              isClickable={true}
              />
          ))
        ) : (
          <Error message="No posts found on this community." />
        )}
      </article>
    </div>
  );
}

export default Community;
