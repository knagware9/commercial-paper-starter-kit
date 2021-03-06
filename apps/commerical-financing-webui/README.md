# Commercial Paper Demo

## User Interface

This demo application contains the user interface for the Hyperledger Composer commercial paper demo. It provides an easy-to-use interface for interacting with the commercial paper Composer network, and demonstrates how to leverage Composer REST server's authentication and multi-user mode capabilities alongside a proprietary authentication scheme.

### Prerequisites

This demo depends on having a Fabric network built by Composer to performs transactions against. For instructions on how to do so, you can visit [insert repo URL here].

### Authentication

One of the primary goals of this interface is to explore how to handle authentication in the context of an organization using the Composer REST server to interact with the Fabric network. In the Fabric network, each participant is an organization such as IBM or ACME, and to perform transactions as one of these organizations an end-user must provide the private certificate of an identity issued by the CA. However, in a real-world scenario, assigning a certificate to each employee of an organization which is a participant on the network is unwieldy. Although the Composer REST server can request and store private certificates, it would be a difficult task to handle issuing, storing, revoking, and updating tens if not hundreds of thousands of certificate pairs. Additionally, this system would have to exist on top of whatever authentication standard the organization currently uses, whether that's LDAP, SAML, OAuth, or some other proprietary strategy.

As such, this user interface combined with the Composer REST server provides a way to separate and independently manage organization authentication vs. user authentication. First, an organizational user is created within Composer REST server using one of the authentication methods which can be plugged-in to Composer REST, such as Github OAuth or local authentication. This user has a wallet associated with it which then has an identity added to it which represents the organization. The "identity" in Composer-speak is essentially a key-pair. Additionally, when the organizational user initially logs-in, an access token is generated by Composer REST server. This access token is copied over into a static configuration file in the UI and the UI then attaches it to all REST requests as a query parameter. Without the token, the REST server is unable to authorize the REST request and rejects the transaction; otherwise, it knows to sign the transaction using the organizational key-pair (identity) associated with that token.

The UI is then free to handle individual user authentication and permissioning as it sees fit. Any custom authentication strategy can be used, or existing authentication systems can be put into place to easily integrate with an organization's infrastructure. In the case of this UI, there are two different authentication strategies used to demonstrate the flexibility of this system: a simple local authentication strategy, and an OAuth strategy leveraging GitHub as an authentication provider. If using local authentication, a user must first register using the simple registration form provided (no confirmation e-mail is used and the user can choose his or her own role(s), this is to make it easy for developers to test out the framework). If using GitHub authentication, the user becomes registered with the UI's database upon logging in via GitHub and is defaulted to have an admin role. Depending on the role associated with a user, the UI will allow that user to perform or not to perform certain actions relating to commercial paper. If it determines that a user is allowed to perform a certain action, it will perform a REST request to the Composer REST server using its stored access token in order to authenticate the action.

### Permissions

The permission system in this UI is fairly simple and straightforward. There are only three roles and a user can be one of all three or any combination of the three. The three roles are as follows:

* Admin
	* An admin can perform all the actions of an issuer or investor, and also gains access to an admin-only user management page where the roles associated with any user on the system can be redefined. It is redundant for a user to be an admin and an issuer/investor. The user management page can be accessed by logging in as an admin user and clicking on the 'Users' tab on the navbar.
* Issuer
	* An issuer can issue commercial paper.
* Investor
	* An investor can purchase commercial paper.

### Setup Instructions

To setup the Composer network and Composer REST server back-end, visit the following link: [insert dank setup link here].

Remember that when running a Composer network, it's expected that there is one network that everybody transacts upon, but each organization runs its own Composer REST server and UI. This is because no one single organization can be trusted to handle every organization's private keys, which the Composer REST server does. As such, the UI is setup in such a way that it can be customized using a server configuration file to adapt to any organization's REST or database endpoints, and there are several `npm` scripts defined to start the UI as one of three organizations which are used as example organizations for this demo. To understand more about the organizations, visit the Composer setup link provided above. The instructions below indicate how to start the UI for the different organizations.

1. Navigate to the directory where you'd like to clone this git repository
2. `git clone [insert repo URL here]`
3. `cd hlfcp-ui`
4. `npm install`
5. `npm run-script start-ibm`
	1. To start as either Google or RedHat, use `npm run-script start-google` or `npm run-script start-redhat`.
6. Go to `127.0.0.1:4200` in your browser to see the UI
	1. If starting as Google, go to `127.0.0.2:4201`
	2. If starting as RedHat, go to `127.0.0.3:4202`
