//import "../css/style.css"
require('./browser-polyfills');
const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingArtifacts = require('../../build/contracts/Voting.json');
const VotingContract = contract(votingArtifacts);


window.App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',

  init: async function() {
    try {
      // Modern dapp browsers
      if (window.ethereum) {
        window.web3 = new Web3(window.ethereum);
        try {
          // Request account access
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          console.log("Connected to MetaMask");
        } catch (error) {
          console.error("User denied account access");
          return;
        }
      }
      // Legacy dapp browsers
      else if (window.web3) {
        window.web3 = new Web3(web3.currentProvider);
      }
      // Fallback to localhost
      else {
        console.warn("No web3 detected. Falling back to http://127.0.0.1:7545.");
        window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));
      }
      return App.initContract();
    } catch (error) {
      console.error("Initialization error:", error);
    }
  },

  initContract: async function() {
    try {
      VotingContract.setProvider(window.web3.currentProvider);
      
      // Get current network ID
      const networkId = await window.web3.eth.net.getId();
      console.log("Current network ID:", networkId);
      
      // Check if contract is deployed on this network
      if (!VotingContract.networks[networkId]) {
        alert(`Contract not deployed on network ${networkId}. Please switch to the correct network.`);
        return;
      }

      const accounts = await window.web3.eth.getAccounts();
      App.account = accounts[0];
      $("#accountAddress").html("Your Account: " + App.account);

      return App.initializeVoting();
    } catch (error) {
      console.error("Contract initialization error:", error);
    }
  },

  initializeVoting: async function() {
    try {
      const instance = await VotingContract.deployed();
      
      // Initialize event listeners
      $(document).ready(function() {
        // Add Candidate
        $('#addCandidate').click(async function() {
          try {
            const nameCandidate = $('#name').val();
            const partyCandidate = $('#party').val();
            // Add from address to transaction
            await instance.addCandidate(nameCandidate, partyCandidate, {
              from: App.account,
              gas: 500000
            });
            window.location.reload();
          } catch (error) {
            console.error("Add candidate error:", error);
          }
        });

        // Add Dates
        $('#addDate').click(async function() {
          try {
            const startDate = Date.parse(document.getElementById("startDate").value)/1000;
            const endDate = Date.parse(document.getElementById("endDate").value)/1000;
            // Add from address to transaction
            await instance.setDates(startDate, endDate, {
              from: App.account,
              gas: 500000
            });
            console.log("Dates set successfully");
            window.location.reload();
          } catch (error) {
            console.error("Set dates error:", error);
          }
        });
      });

      // Load voting data
      await App.loadVotingData(instance);
    } catch (error) {
      console.error("Voting initialization error:", error);
    }
  },

loadVotingData: async function(instance) {
    try {
      // Get and display voting dates
      const dates = await instance.getDates();
      const startDate = new Date(dates[0] * 1000);
      const endDate = new Date(dates[1] * 1000);
      const now = new Date();
      
      // First, enable the button by default
      $("#voteButton").prop("disabled", false);
      
      let dateMessage = "";
      if (dates[0] == 0 && dates[1] == 0) {
        dateMessage = "Voting period has not been set yet";
        $("#voteButton").prop("disabled", true);
      } else if (now < startDate) {
        dateMessage = `Voting will start on ${startDate.toLocaleString()}`;
        $("#voteButton").prop("disabled", true);
      } else if (now > endDate) {
        dateMessage = "Voting period has ended";
        $("#voteButton").prop("disabled", true);
      } else {
        dateMessage = `Voting is active until ${endDate.toLocaleString()}`;
      }
      $("#dates").html(dateMessage);

      // Load candidates
      const candidateCount = await instance.getCountCandidates();
      let candidatesResults = "";
      let candidatesSelect = "";
      
      for (var i = 1; i <= candidateCount; i++) {
        const candidate = await instance.getCandidate(i);
        const voteCount = candidate[3].toString(); // Convert BigNumber to string
        candidatesResults += "<tr><td>" + candidate[1] + "</td><td>" + candidate[2] + "</td><td>" + voteCount + "</td></tr>";
        candidatesSelect += `<input type="radio" name="candidate" value="${i}"> ${candidate[1]} (${candidate[2]})<br>`;
      }
      
      $("#boxCandidate").html(candidatesResults);
      $("#vote-box").html(candidatesSelect);

      // Check if user has voted
      const hasVoted = await instance.checkVote({from: App.account});
      if (hasVoted) {
        $("#msg").html("<p>You have already voted.</p>");
        $("#voteButton").prop("disabled", true);
      }

      // Add change event listener for radio buttons
      $('input[name="candidate"]').change(function() {
        if ($('input[name="candidate"]:checked').length > 0) {
          $("#voteButton").prop("disabled", false);
        }
      });

    } catch (error) {
      console.error("Load voting data error:", error);
      $("#msg").html("<p>Error loading voting data. Please check console for details.</p>");
    }
},

vote: async function() {
  try {
      // Validate MetaMask connection
      if (!window.ethereum.isConnected()) {
          $("#msg").html("<p>MetaMask is not connected</p>");
          return;
      }

      const candidateID = $("input[name='candidate']:checked").val();
      if (!candidateID) {
          $("#msg").html("<p>Please select a candidate to vote.</p>");
          return;
      }

      // Get current account
      const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
          $("#msg").html("<p>Please connect your MetaMask account</p>");
          return;
      }
      App.account = accounts[0];

      const instance = await VotingContract.deployed();
      
      $("#msg").html("<p>Please confirm the transaction in MetaMask...</p>");
      $("#voteButton").prop("disabled", true);

      // Get current network
      const networkId = await window.web3.eth.net.getId();
      if (!VotingContract.networks[networkId]) {
          $("#msg").html("<p>Please switch to the correct network in MetaMask</p>");
          $("#voteButton").prop("disabled", false);
          return;
      }

      // Check if voting is active
      const dates = await instance.getDates();
      const now = Math.floor(Date.now() / 1000);
      if (dates[0] == 0 || dates[1] == 0) {
          $("#msg").html("<p>Voting period has not been set</p>");
          $("#voteButton").prop("disabled", false);
          return;
      }
      if (now < dates[0]) {
          $("#msg").html("<p>Voting has not started yet</p>");
          $("#voteButton").prop("disabled", false);
          return;
      }
      if (now > dates[1]) {
          $("#msg").html("<p>Voting has ended</p>");
          $("#voteButton").prop("disabled", false);
          return;
      }

      // Estimate gas
      const gasEstimate = await instance.vote.estimateGas(
          parseInt(candidateID), 
          { from: App.account }
      );

      // Add 20% buffer to gas estimate
      const gasLimit = Math.ceil(gasEstimate * 1.2);

      const result = await instance.vote(parseInt(candidateID), {
          from: App.account,
          gas: gasLimit
      });

      console.log("Vote transaction:", result);
      
      // Wait for transaction confirmation
      $("#msg").html("<p>Transaction submitted. Waiting for confirmation...</p>");
      
      // Check for events
      if (result.logs && result.logs.length > 0) {
          const event = result.logs.find(log => log.event === 'VoteCast');
          if (event) {
              $("#msg").html("<p>Your vote has been recorded successfully!</p>");
              await App.loadVotingData(instance);
          }
      }
  } catch (error) {
      console.error("Voting error:", error);
      let errorMessage = "Transaction failed. ";
      
      if (error.message.includes("revert")) {
          const match = error.message.match(/revert\s+(.*?)(?:"|\n|$)/);
          if (match) {
              errorMessage += match[1];
          }
      } else if (error.message.includes("Internal JSON-RPC error")) {
          errorMessage = "Please make sure you have enough ETH for gas fees and try again.";
      } else if (error.message.includes("User denied")) {
          errorMessage = "Transaction was rejected in MetaMask.";
      }
      
      $("#msg").html(`<p>Error: ${errorMessage}</p>`);
      $("#voteButton").prop("disabled", false);
  }
}
};

window.addEventListener("load", function() {
  App.init();
});
