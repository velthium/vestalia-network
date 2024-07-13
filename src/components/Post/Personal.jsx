import { useQuery } from "@tanstack/react-query";
import Post from "@/components/Main/Post/Index";
import { request, gql } from "graphql-request";
import PageTitle from "@/components/Ui/Title";
import { useParams } from "react-router-dom";
import Loading from "@/components/Loading";
import Error from "@/components/Ui/Error";
import React from "react";

const MyPosts = () => {
  const PERSONAL_POSTS = gql`
    query GetPosts($authorAddress: String!) {
      post(where: { author_address: { _eq: $authorAddress } }) {
        text
        id
        subspace_section {
          name
          id
        }
        post_url {
          url
        }
      }
    }
  `;

  const { address } = useParams();

  const { data: personalPosts, isLoading, isError } = useQuery({
    queryKey: ["personalPost"],
    queryFn: async () => request("http://localhost:8080/v1/graphql/", PERSONAL_POSTS, { authorAddress: address }).then(res => (res.post))
  });

  if (isLoading) return <Loading />;
  if (isError) return <Error message="Error fetching personnal post data." />;
  if (personalPosts.length === 0) return <Error message="No personal posts found." />;

  return (
    <div>
      <PageTitle title="My posts" />
      <ul className="list-unstyled">
        {personalPosts.map((post, index) => (
          <Post
            post={post}
            post_page={false}
            index={index}
            key={index} 
            isClickable={false}
            />
        ))}
      </ul>
    </div>
  );
};

export default MyPosts;