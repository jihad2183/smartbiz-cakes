<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Admin management uses the existing browser client and database RLS; never bypass administrator approval or grant roles from signup metadata.
- Website text and settings are persisted as site_content keys shared by the storefront and admin editor, so saved changes appear throughout the shop.
- Bundled cake photos use symbolic cake image keys resolved by cake-images, keeping stored catalog entries valid across builds.
