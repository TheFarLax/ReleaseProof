# GitHub Pages par live kaise karein

Is project ka frontend static hai. Contract pehle se Studionet par deployed hai.

## 1. ZIP extract karo

ZIP mein ReleaseProof_Project folder milega. Uske andar app, contracts, package.json, README.md aur hidden .github folder hona chahiye.

Agar unzip command missing ho aur Ubuntu/Debian shell use kar rahe ho:

~~~bash
apt update
apt install -y unzip
~~~

Ya Python se extract kar sakte ho:

~~~bash
python3 -m zipfile -e /sdcard/Download/ReleaseProof_Project.zip /tmp/releaseproof-extracted
~~~

## 2. Fresh GitHub repository banao

GitHub par **ReleaseProof** naam ka public repo banao. Agar repo pehle bana hua hai, usi ka clone use karo. Pehle se populated repo mein copy karne se pehle uske changes review karo.

Fresh repo ke example commands:

~~~bash
git clone https://github.com/TheFarLax/ReleaseProof.git
cd ReleaseProof
cp -a /tmp/releaseproof-extracted/ReleaseProof_Project/. .
git add .
git commit -m "Add ReleaseProof GenLayer application"
git push origin main
~~~

Agar fresh empty repo ka branch main nahi hai, commit ke baad main set karo:

~~~bash
git branch -M main
git push -u origin main
~~~

TheFarLax/ReleaseProof sirf suggested repository location hai; ye guide us repo ke create ya push ho chukne ka claim nahi karti.

## 3. Pages source select karo

Repository kholo → **Settings → Pages → Build and deployment → Source → GitHub Actions**.

**Folder select nahi karna.** Included workflow khud dist folder build karke deploy karega. “Deploy from a branch” ki jagah “GitHub Actions” chahiye.

## 4. Workflow chalao

**Actions → Deploy ReleaseProof to Pages → Run workflow → main → Run workflow**.

Ya main par next push karo. Green check aane ke baad Pages settings ya deployment output mein live URL milega. Wahi exact URL submission mein lagao.

## 5. Verify karo

- Site open ho aur teen historical case studies dikhein.
- “Live finalized state” ya clearly labelled snapshot status dikhe.
- Automatic OPTIONS → Review history mein initial aur challenged finding dono dikhein.
- Export button se JSON download ho.
- Wallet browser mein connect karke new release register aur audit kar sako.

## Agar error aaye

**Workflow missing:** Hidden .github/workflows/pages.yml upload hua hai ya nahi check karo.

**Pages deployment blocked:** Pages Source GitHub Actions rakho; repository/environment policies main se deployment allow karni chahiye.

**Blank page:** Source index.html ko direct branch se serve mat karo. Workflow ka built dist artifact publish hona chahiye.

**Wallet missing:** Normal Chrome mobile mein extension provider nahi hota. Site ko wallet ke in-app browser mein kholo.

**Audit fails:** Small public comparison use karo. Selected paths changed files hone chahiye. Binary/truncated/large patches accept nahi hote.

**Transaction pending:** “Track status” use karo. Pending transaction resolve hue bina duplicate write mat bhejo.

Reference: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
